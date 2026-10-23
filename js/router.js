/* ==========================================================================
   Master Web IDE Ultra - Auto Model Router (AIModelRouter)
   ---------------------------------------------------------------------------
   A zero-backend routing engine that lives entirely inside the user's browser.
   It sits between the AI Agent and the user's OWN provider and decides which
   model should answer a prompt.

   Ideas ported from the FreeLLMAPI routing core:
     • weighted scoring   — reliability / speed / intelligence (bandit presets)
     • exponential decay  — old samples fade out (2-day half-life, 7-day window)
     • per-model penalty  — failures add a penalty that decays away over time
     • cooldowns          — a broken model is "benched" per error class
     • circuit breaker    — a dead chain stops early instead of burning quota
     • time budget        — the whole chain must answer inside a deadline
     • hedging (race)     — a second model is started while the first is still
                            thinking, so the fastest model that actually answers
                            is the one that wins

   EVERY statistic lives in localStorage on the user's own device.
   No telemetry. No backend. The router only ever talks to the provider the
   user picked, using the key the user pasted.
   ========================================================================== */

const AIModelRouter = (function () {
    'use strict';

    // ── Storage ────────────────────────────────────────────────────────────
    const STATS_KEY = 'master_ide_ai_stats';

    // ── Tunables (mirrored from the FreeLLMAPI routing core) ───────────────
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;      // 7-day rolling window
    const HALF_LIFE_MS = 2 * 24 * 60 * 60 * 1000;   // 2-day half-life
    const PRIOR_SUCCESS = 1;
    const PRIOR_FAILURE = 1;

    const MAX_PENALTY = 10;
    const PENALTY_PER_FAIL = 1;
    const PENALTY_PER_429 = 3;
    const PENALTY_DECAY_MS = 2 * 60 * 1000;
    const PENALTY_DECAY_AMOUNT = 1;

    const BREAKER_LIMIT = 3;
    const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

    const DEFAULT_BUDGET_MS = 45000;
    const DEFAULT_ATTEMPT_TIMEOUT_MS = 20000;
    const DEFAULT_HEDGE_MS = 6000;

    const MAX_SAMPLES = 120;

    const SPEED_SCALE_TOK_S = 60;
    const TTFB_BEST_MS = 300;
    const TTFB_WORST_MS = 5000;
    const THROUGHPUT_WEIGHT = 0.6;
    const TTFB_WEIGHT = 0.4;
    const SPEED_PRIOR = 0.6;

    const PENALTY_DAMP = 0.6;   // a max penalty can shrink a score by 60%

    /** Bandit-style weight presets — exactly the FreeLLMAPI preset table. */
    const STRATEGIES = {
        balanced: { label: 'Balanced (recommended)', reliability: 0.50, speed: 0.25, intelligence: 0.25 },
        smartest: { label: 'Smartest', reliability: 0.35, speed: 0.10, intelligence: 0.55 },
        fastest: { label: 'Fastest', reliability: 0.35, speed: 0.55, intelligence: 0.10 },
        reliable: { label: 'Most reliable', reliability: 0.70, speed: 0.15, intelligence: 0.15 }
    };

    /** How long a model is benched after each error class. */
    const BENCH_MS = {
        auth: 0,                                   // provider-wide → stop the chain
        rate_limit: 5 * 60 * 1000,
        quota: 60 * 60 * 1000,
        not_found: 30 * 60 * 1000,
        server: 60 * 1000,
        timeout: 90 * 1000,
        network: 30 * 1000,
        bad_request: 0,
        unknown: 0
    };

    /** Penalty weight per error class. */
    const PENALTY_WEIGHT = {
        rate_limit: PENALTY_PER_429,
        quota: PENALTY_PER_429,
        auth: PENALTY_PER_429,
        default: PENALTY_PER_FAIL
    };

    // ── In-memory store ────────────────────────────────────────────────────
    let store = { v: 1, models: {}, disabled: {} };
    let saveTimer = null;

    function blankEntry() {
        return {
            samples: [],          // { t, ok, ms, ttfb, tokens }
            penalty: 0,
            penaltyAt: 0,
            consecutiveFails: 0,
            breakerUntil: 0,
            benchUntil: 0,
            benchReason: '',
            lastUsed: 0,
            lastOk: 0,
            lastError: '',
            lastErrorAt: 0,
            totalOk: 0,
            totalFail: 0
        };
    }

    // ── Persistence ────────────────────────────────────────────────────────
    function load() {
        try {
            const raw = localStorage.getItem(STATS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                store = {
                    v: parsed.v || 1,
                    models: (parsed.models && typeof parsed.models === 'object') ? parsed.models : {},
                    disabled: (parsed.disabled && typeof parsed.disabled === 'object') ? parsed.disabled : {}
                };
            }
        } catch (e) {
            // corrupted store → start from a clean slate instead of crashing
            store = { v: 1, models: {}, disabled: {} };
        }
    }

    function persist() {
        try {
            localStorage.setItem(STATS_KEY, JSON.stringify(store));
        } catch (e) {
            // storage full or blocked → the router keeps working in memory only
        }
    }

    function save(immediate = false) {
        if (immediate) {
            if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
            persist();
            return;
        }
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveTimer = null; persist(); }, 250);
    }

    function flush() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        persist();
    }

    // ── Keys & entries ─────────────────────────────────────────────────────
    function statKey(provider, modelId) {
        return String(provider || 'unknown') + ':' + String(modelId || '');
    }

    function getEntry(key) {
        if (!store.models[key]) store.models[key] = blankEntry();
        const e = store.models[key];
        if (!Array.isArray(e.samples)) e.samples = [];
        return e;
    }

    function peekEntry(key) {
        return store.models[key] || null;
    }

    // ── Decay & aggregation ────────────────────────────────────────────────
    /** Exponential decay weight for a sample of the given age. */
    function decayWeight(ageMs) {
        if (!(ageMs >= 0)) return 0;
        return Math.pow(0.5, ageMs / HALF_LIFE_MS);
    }

    /** Collapses the raw samples into decayed, windowed aggregates. */
    function aggregate(entry) {
        const out = {
            successes: 0, failures: 0, samples: 0,
            avgLatency: null, avgTtfb: null, tokPerSec: 0, successRate: null
        };
        if (!entry || !Array.isArray(entry.samples) || !entry.samples.length) return out;

        const now = Date.now();
        let s = 0, f = 0;
        let latSum = 0, latW = 0;
        let ttfbSum = 0, ttfbW = 0;
        let tokens = 0, tokenSeconds = 0;

        for (let i = 0; i < entry.samples.length; i++) {
            const smp = entry.samples[i];
            if (!smp || typeof smp.t !== 'number') continue;
            const age = now - smp.t;
            if (age > WINDOW_MS) continue;              // outside the rolling window
            const w = decayWeight(age);
            if (smp.ok) {
                s += w;
                latSum += (smp.ms || 0) * w;
                latW += w;
                if (typeof smp.ttfb === 'number') { ttfbSum += smp.ttfb * w; ttfbW += w; }
                if (smp.tokens && smp.ms) { tokens += smp.tokens; tokenSeconds += smp.ms / 1000; }
            } else {
                f += w;
            }
            out.samples++;
        }

        out.successes = s;
        out.failures = f;
        if (latW > 0) out.avgLatency = latSum / latW;
        if (ttfbW > 0) out.avgTtfb = ttfbSum / ttfbW;
        if (tokenSeconds > 0.05) out.tokPerSec = tokens / tokenSeconds;
        const total = s + f;
        if (total > 0) out.successRate = s / total;
        return out;
    }

    // ── Scoring primitives ─────────────────────────────────────────────────
    /** Beta posterior → expected reliability. */
    function reliabilityOf(successes, failures) {
        const alpha = Math.max(0, successes || 0) + PRIOR_SUCCESS;
        const beta = Math.max(0, failures || 0) + PRIOR_FAILURE;
        return alpha / (alpha + beta);
    }

    function throughputScore(tokPerSec) {
        if (!tokPerSec || tokPerSec <= 0) return 0;
        return 1 - Math.exp(-tokPerSec / SPEED_SCALE_TOK_S);
    }

    function ttfbScore(ttfbMs) {
        if (typeof ttfbMs !== 'number' || !isFinite(ttfbMs)) return 0;
        if (ttfbMs <= TTFB_BEST_MS) return 1;
        if (ttfbMs >= TTFB_WORST_MS) return 0;
        return 1 - (ttfbMs - TTFB_BEST_MS) / (TTFB_WORST_MS - TTFB_BEST_MS);
    }

    /**
     * Speed heuristic derived from the model id.
     * Used as the prior for models that have never been measured, so the
     * "fastest" strategy still puts a turbo model in front of a pro model
     * before a single request has been made.
     */
    function speedHeuristic(modelId) {
        const s = String(modelId || '').toLowerCase();
        let score = 0.6;

        const rules = [
            [/(^|[-_/])nano($|[-_/])/, 0.95],
            [/\bflash\b/, 0.92],
            [/\bturbo\b/, 0.90],
            [/(^|[-_/])lite($|[-_/])/, 0.88],
            [/(^|[-_/])mini($|[-_/])/, 0.86],
            [/\bhaiku\b/, 0.85],
            [/(^|[-_/])small($|[-_/])/, 0.82],
            [/(^|[-_/])chat($|[-_/])/, 0.70],
            [/\bsonnet\b/, 0.55],
            [/(^|[-_/])pro($|[-_/])/, 0.50],
            [/\bopus\b/, 0.38],
            [/(^|[-_/])max($|[-_/])/, 0.35],
            [/\breason/, 0.35],
            [/\bultra\b/, 0.30]
        ];

        for (let i = 0; i < rules.length; i++) {
            if (rules[i][0].test(s)) { score = rules[i][1]; break; }
        }

        // A smaller parameter count usually means a faster model
        const pm = s.match(/(\d+(?:\.\d+)?)\s?b\b/);
        if (pm) {
            const params = parseFloat(pm[1]);
            if (params >= 400) score = Math.min(score, 0.20);
            else if (params >= 90) score = Math.min(score, 0.30);
            else if (params >= 60) score = Math.min(score, 0.38);
            else if (params >= 30) score = Math.min(score, 0.55);
            else if (params >= 13) score = Math.min(score, 0.70);
            else if (params >= 7) score = Math.max(score, 0.78);
            else score = Math.max(score, 0.90);
        }

        return Math.min(1, Math.max(0, score));
    }

    /**
     * Speed score of a model.
     * @param {number}  tokPerSec  measured throughput (0 when unknown)
     * @param {number}  ttfbMs     measured time-to-first-byte (null when unknown)
     * @param {string}  modelId    used for the heuristic prior
     */
    function speedScore(tokPerSec, ttfbMs, modelId) {
        const measured = (tokPerSec && tokPerSec > 0) || (typeof ttfbMs === 'number' && isFinite(ttfbMs));
        if (!measured) {
            // Nothing measured yet → fall back to the id heuristic (or the
            // neutral prior when no model id is known).
            if (modelId) return speedHeuristic(modelId);
            return SPEED_PRIOR;
        }
        const tp = throughputScore(tokPerSec);
        if (ttfbMs === null || ttfbMs === undefined) return tp;
        if (!tokPerSec || tokPerSec <= 0) return ttfbScore(ttfbMs);
        return THROUGHPUT_WEIGHT * tp + TTFB_WEIGHT * ttfbScore(ttfbMs);
    }

    /**
     * Intelligence heuristic derived from the model id.
     * The IDE has no `intelligence_rank` column, so we read the family name
     * and the parameter count — the same signals a human would use.
     */
    function intelligenceHeuristic(modelId) {
        const s = String(modelId || '').toLowerCase();
        let score = 0.55;

        const rules = [
            [/\bopus\b/, 0.98],
            [/\bsonnet\b/, 0.82],
            [/\bhaiku\b/, 0.60],
            [/gpt-4o-mini/, 0.58],
            [/gpt-4o-mini/, 0.58],
            [/gpt-4\.1/, 0.86],
            [/gpt-4o/, 0.82],
            [/gpt-4/, 0.78],
            [/gpt-5/, 0.92],
            [/(^|[-_/])o1($|[-_/])/, 0.88],
            [/(^|[-_/])o3($|[-_/])/, 0.88],
            [/(^|[-_/])o4($|[-_/])/, 0.90],
            [/reason/, 0.90],
            [/deepseek-?r1/, 0.90],
            [/thinking/, 0.86],
            [/ultra/, 0.95],
            [/(^|[-_/])max($|[-_/])/, 0.90],
            [/(^|[-_/])pro($|[-_/])/, 0.85],
            [/turbo/, 0.72],
            [/flash/, 0.50],
            [/(^|[-_/])mini($|[-_/])/, 0.45],
            [/(^|[-_/])nano($|[-_/])/, 0.30],
            [/(^|[-_/])lite($|[-_/])/, 0.38],
            [/(^|[-_/])chat($|[-_/])/, 0.50],
            [/(^|[-_/])small($|[-_/])/, 0.35]
        ];

        for (let i = 0; i < rules.length; i++) {
            if (rules[i][0].test(s)) { score = rules[i][1]; break; }
        }

        // Parameter count is a strong signal (405b ≫ 7b ≫ 1b)
        const pm = s.match(/(\d+(?:\.\d+)?)\s?b\b/);
        if (pm) {
            const params = parseFloat(pm[1]);
            if (params >= 400) score = Math.max(score, 0.97);
            else if (params >= 90) score = Math.max(score, 0.88);
            else if (params >= 60) score = Math.max(score, 0.84);
            else if (params >= 30) score = Math.max(score, 0.72);
            else if (params >= 13) score = Math.max(score, 0.62);
            else if (params >= 7) score = Math.max(score, 0.48);
            else score = Math.min(score, 0.35);
        }

        return Math.min(1, Math.max(0, score));
    }

    /** Weighted blend of the three axes. */
    function combineScore(inputs, weights) {
        const w = weights || STRATEGIES.balanced;
        const total = (w.reliability + w.speed + w.intelligence) || 1;
        return (inputs.reliability * w.reliability +
            inputs.speed * w.speed +
            inputs.intelligence * w.intelligence) / total;
    }

    // ── Penalties, benches, breaker ────────────────────────────────────────
    /** The current (decayed) penalty of a model. */
    function penaltyOf(key) {
        const entry = peekEntry(key);
        if (!entry) return 0;
        const penalty = entry.penalty || 0;
        if (penalty <= 0) return 0;
        const elapsed = Date.now() - (entry.penaltyAt || 0);
        const steps = Math.floor(elapsed / PENALTY_DECAY_MS);
        if (steps <= 0) return penalty;
        return Math.max(0, penalty - steps * PENALTY_DECAY_AMOUNT);
    }

    function isBenched(key) {
        const entry = peekEntry(key);
        if (!entry) return false;
        return (entry.benchUntil || 0) > Date.now();
    }

    function benchRemaining(key) {
        const entry = peekEntry(key);
        if (!entry) return 0;
        return Math.max(0, (entry.benchUntil || 0) - Date.now());
    }

    function isBreakerOpen(key) {
        const entry = peekEntry(key);
        if (!entry) return false;
        return (entry.breakerUntil || 0) > Date.now();
    }

    // ── Error classification ───────────────────────────────────────────────
    function classifyError(error) {
        if (!error) return 'unknown';
        const status = error.status || (error.response && error.response.status) || 0;
        const msg = String(error.message || error.error || '').toLowerCase();

        if (status === 401 || status === 403) return 'auth';
        if (/api key not valid|invalid api key|unauthorized|authentication|api-key-invalid|permission denied/.test(msg)) return 'auth';
        if (status === 402) return 'quota';
        if (/payment required|insufficient credit|billing|out of credits/.test(msg)) return 'quota';
        if (status === 429) return 'rate_limit';
        if (/rate limit|too many requests|resource[_ ]exhausted|quota exceeded|overloaded|resource exhausted/.test(msg)) return 'rate_limit';
        if (status === 404 || /not found|is not supported|does not exist|unknown model/.test(msg)) return 'not_found';
        if (/timeout|timed out|deadline exceeded|abort/.test(msg)) return 'timeout';
        if (/failed to fetch|networkerror|network error|econnrefused|err_internet|failed to load|load failed/.test(msg)) return 'network';
        if (status >= 500) return 'server';
        if (status >= 400) return 'bad_request';
        return 'unknown';
    }

    // ── Recording outcomes ─────────────────────────────────────────────────
    function pushSample(entry, sample) {
        if (!Array.isArray(entry.samples)) entry.samples = [];
        entry.samples.push(sample);
        // keep the store small: drop the oldest samples
        if (entry.samples.length > MAX_SAMPLES) {
            entry.samples = entry.samples.slice(entry.samples.length - MAX_SAMPLES);
        }
        // and drop samples that fell out of the window entirely
        const cutoff = Date.now() - WINDOW_MS;
        if (entry.samples.length > 20) {
            entry.samples = entry.samples.filter(s => s && s.t >= cutoff);
        }
    }

    function recordSuccess(key, ms, ttfb, tokens) {
        const entry = getEntry(key);
        const now = Date.now();
        entry.consecutiveFails = 0;
        entry.breakerUntil = 0;
        entry.penalty = Math.max(0, penaltyOf(key) - 1);
        entry.penaltyAt = now;
        entry.benchUntil = 0;
        entry.benchReason = '';
        entry.lastUsed = now;
        entry.lastOk = now;
        entry.lastError = '';
        entry.totalOk = (entry.totalOk || 0) + 1;
        pushSample(entry, { t: now, ok: true, ms: ms || 0, ttfb: (typeof ttfb === 'number' ? ttfb : null), tokens: tokens || 0 });
        save();
    }

    function recordFailure(key, error, errorClass) {
        const entry = getEntry(key);
        const now = Date.now();
        const cls = errorClass || classifyError(error);

        entry.consecutiveFails = (entry.consecutiveFails || 0) + 1;
        entry.totalFail = (entry.totalFail || 0) + 1;
        entry.lastUsed = now;
        entry.lastError = String((error && error.message) || cls).slice(0, 400);
        entry.lastErrorAt = now;

        const weight = PENALTY_WEIGHT[cls] || PENALTY_WEIGHT.default;
        entry.penalty = Math.min(MAX_PENALTY, penaltyOf(key) + weight);
        entry.penaltyAt = now;

        const benchMs = BENCH_MS[cls] || 0;
        if (benchMs > 0) {
            entry.benchUntil = now + benchMs;
            entry.benchReason = cls;
        }

        if (entry.consecutiveFails >= BREAKER_LIMIT) {
            entry.breakerUntil = now + BREAKER_COOLDOWN_MS;
        }

        pushSample(entry, { t: now, ok: false, ms: 0, ttfb: null, tokens: 0 });
        save();
        return cls;
    }

    // ── Chain building ─────────────────────────────────────────────────────
    function healthOf(agg, entry) {
        if (!agg || !agg.samples) return 'unknown';
        if (isBreakerOpen(entry && entry.__key)) return 'down';
        const rate = agg.successRate;
        if (rate === null) return 'unknown';
        if (rate >= 0.9 && agg.samples >= 3) return 'good';
        if (rate >= 0.5) return 'fair';
        return 'poor';
    }

    /**
     * Turns the auto-discovered model list into an ordered candidate chain.
     * @param {string} provider
     * @param {Array}  models   [{ id, label, ... }]
     * @param {object} options  { strategy, preferred }
     */
    function buildChain(provider, models, options = {}) {
        const strategy = STRATEGIES[options.strategy] ? options.strategy : 'balanced';
        const weights = STRATEGIES[strategy];
        const list = Array.isArray(models) ? models : [];
        const disabled = store.disabled[provider] || {};

        const candidates = [];

        for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            const id = typeof raw === 'string' ? raw : (raw && raw.id);
            if (!id) continue;
            const label = (raw && raw.label) || id;
            const key = statKey(provider, id);
            const entry = getEntry(key);
            const agg = aggregate(entry);

            const reliability = reliabilityOf(agg.successes, agg.failures);
            const speed = speedScore(agg.tokPerSec, agg.avgTtfb, id);
            const intelligence = intelligenceHeuristic(id);
            const base = combineScore({ reliability, speed, intelligence }, weights);
            const penalty = penaltyOf(key);
            const score = base * (1 - (penalty / MAX_PENALTY) * PENALTY_DAMP);

            const info = {
                id: id,
                label: label,
                key: key,
                score: score,
                baseScore: base,
                reliability: reliability,
                speed: speed,
                intelligence: intelligence,
                penalty: penalty,
                benchRemaining: benchRemaining(key),
                benched: isBenched(key),
                breakerOpen: isBreakerOpen(key),
                disabled: !!disabled[id],
                stats: agg,
                health: 'unknown'
            };
            info.health = healthOf(agg, { __key: key });
            candidates.push(info);
        }

        // Benched / tripped models sink to the bottom but stay available.
        candidates.sort((a, b) => {
            const aBad = (a.benched ? 1 : 0) + (a.breakerOpen ? 2 : 0);
            const bBad = (b.benched ? 1 : 0) + (b.breakerOpen ? 2 : 0);
            if (aBad !== bBad) return aBad - bBad;
            if (b.score !== a.score) return b.score - a.score;
            return a.id.localeCompare(b.id);
        });

        // An explicit manual pick stays in front of the automatic order.
        const preferred = options.preferred || '';
        if (preferred) {
            const idx = candidates.findIndex(c => c.id === preferred);
            if (idx > 0) candidates.unshift(candidates.splice(idx, 1)[0]);
        }

        return candidates;
    }

    // ── The fallback / race loop ───────────────────────────────────────────
    /**
     * Runs the candidate chain until one model answers.
     *
     *  • the first candidate is tried immediately
     *  • after `hedgeMs` a second candidate is started in parallel (the race)
     *    — the slower one is aborted as soon as the faster one wins
     *  • a failing model is skipped, the next one takes over
     *  • the whole chain has to answer inside `timeBudgetMs`
     *  • the circuit breaker stops the chain after too many consecutive fails
     *
     * @param {Array}  candidates ordered candidate list from buildChain()
     * @param {Function} dispatch (candidate, attempt) => Promise
     * @param {Object} options { timeBudgetMs, attemptTimeoutMs, hedgeMs }
     */
    async function runChain(candidates, dispatch, options = {}) {
        const list = Array.isArray(candidates) ? candidates : [];
        const budgetMs = Math.max(0, Number(options.timeBudgetMs != null ? options.timeBudgetMs : DEFAULT_BUDGET_MS));
        const attemptTimeoutMs = Math.max(0, Number(options.attemptTimeoutMs != null ? options.attemptTimeoutMs : DEFAULT_ATTEMPT_TIMEOUT_MS));
        const hedgeMs = Math.max(0, Number(options.hedgeMs != null ? options.hedgeMs : DEFAULT_HEDGE_MS));

        const startedAt = Date.now();
        const deadline = startedAt + budgetMs;

        const inFlight = new Map();     // index -> { controller, attempt }
        const launched = new Set();
        const log = [];
        let lastError = null;
        let consecutiveFails = 0;
        let budgetExpired = false;
        let hedged = false;
        let hedgeTimer = null;

        // ── the outcome queue ──
        // Every attempt (including one that is launched later as a hedge)
        // pushes its result here. The loop waits on this queue instead of on
        // a fixed set of promises, so a hedge that starts while the loop is
        // already waiting is picked up immediately.
        const outcomeQueue = [];
        let notify = null;

        function armNotify() {
            let res;
            const p = new Promise(r => { res = r; });
            notify = res;
            return p;
        }

        function pushOutcome(outcome) {
            outcomeQueue.push(outcome);
            if (notify) {
                const n = notify;
                notify = null;
                n();
            }
        }

        function launch(index) {
            if (index < 0 || index >= list.length) return null;
            const cand = list[index];
            const controller = new AbortController();
            const attempt = {
                key: cand.key,
                id: cand.id,
                label: cand.label,
                controller: controller,
                startedAt: Date.now(),
                superseded: false,
                timedOut: false,
                ttfb: null,
                tokens: 0,
                toolCalls: 0
            };

            // The attempt always settles exactly once — the provider may answer,
            // fail, hang (timeout) or be cut off by the global deadline.
            let settled = false;
            const settle = (outcome) => {
                if (settled) return;
                settled = true;
                pushOutcome(outcome);
            };

            Promise.resolve()
                .then(() => dispatch(cand, attempt))
                .then(
                    value => settle({ ok: true, value: value, attempt: attempt, index: index }),
                    error => settle({ ok: false, error: error, attempt: attempt, index: index })
                );

            const entry = { controller: controller, attempt: attempt, index: index, settle: settle };
            inFlight.set(index, entry);
            launched.add(index);

            // per-attempt timeout — a hung model must not eat the whole budget
            if (attemptTimeoutMs > 0) {
                const room = Math.max(0, deadline - Date.now());
                entry.timer = setTimeout(() => {
                    attempt.timedOut = true;
                    try { controller.abort('timeout'); } catch (e) { /* ignore */ }
                    settle({
                        ok: false,
                        error: new Error('The model did not answer in time.'),
                        attempt: attempt,
                        index: index,
                        timeout: true
                    });
                }, Math.min(attemptTimeoutMs, room || attemptTimeoutMs));
            }

            return entry;
        }

        function clearEntryTimer(index) {
            const entry = inFlight.get(index);
            if (entry && entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
        }

        function scheduleHedge() {
            if (hedgeMs <= 0 || hedged) return;
            if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }
            hedgeTimer = setTimeout(() => {
                hedgeTimer = null;
                if (hedged || budgetExpired || Date.now() >= deadline) return;
                if (nextIndex >= list.length) return;

                // Never hedge a model that already touched the project files —
                // the losing attempt must stay side-effect free.
                for (const entry of inFlight.values()) {
                    if (entry.attempt.toolCalls > 0) return;
                }

                const cand = list[nextIndex];
                if (!cand) return;
                if (cand.disabled) { nextIndex++; scheduleHedge(); return; }
                if (isBenched(cand.key)) { nextIndex++; scheduleHedge(); return; }

                const idx = nextIndex++;
                hedged = true;
                launch(idx);
                log.push({ model: cand.id, status: 'hedge', ms: 0 });
            }, hedgeMs);
        }

        let nextIndex = 0;

        // ── first attempt ──
        while (nextIndex < list.length) {
            const cand = list[nextIndex];
            const idx = nextIndex++;
            if (!cand || cand.disabled) continue;
            if (isBenched(cand.key)) { log.push({ model: cand.id, status: 'skipped', reason: 'benched' }); continue; }
            launch(idx);
            break;
        }

        if (!inFlight.size) {
            const e = new Error('No usable model is available for this request.');
            e.router = true;
            e.attempts = log;
            throw e;
        }

        // 🏁 Start the race: if the first model is still thinking after
        // `hedgeMs` a second model is launched in parallel.
        scheduleHedge();

        // ── global deadline ──
        let deadlineTimer = null;
        if (budgetMs > 0) {
            deadlineTimer = setTimeout(() => {
                budgetExpired = true;
                for (const entry of inFlight.values()) {
                    entry.attempt.superseded = true;
                    try { entry.controller.abort('budget'); } catch (e) { /* ignore */ }
                    // settle the attempt even if the provider ignores the signal
                    entry.settle({
                        ok: false,
                        error: new Error('The time budget was exhausted.'),
                        attempt: entry.attempt,
                        index: entry.index,
                        budget: true
                    });
                }
            }, budgetMs);
        }

        try {
            while (inFlight.size > 0) {
                // Wait for the next attempt to settle. The queue is used
                // instead of a fixed promise set so that a hedge which is
                // launched while we are already waiting is noticed at once.
                if (!outcomeQueue.length) {
                    await armNotify();
                }
                const outcome = outcomeQueue.shift();
                if (!outcome) continue;

                clearEntryTimer(outcome.index);
                inFlight.delete(outcome.index);

                if (outcome.ok) {
                    // the winner — abort every loser so no stray tool runs
                    for (const entry of inFlight.values()) {
                        entry.attempt.superseded = true;
                        try { entry.controller.abort('superseded'); } catch (e) { /* ignore */ }
                    }
                    inFlight.clear();
                    if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }

                    const elapsed = Date.now() - outcome.attempt.startedAt;
                    recordSuccess(outcome.attempt.key, elapsed, outcome.attempt.ttfb, outcome.attempt.tokens);
                    log.push({ model: outcome.attempt.id, status: 'success', ms: elapsed });

                    return {
                        model: outcome.attempt.id,
                        value: outcome.value,
                        attempts: log,
                        elapsed: elapsed
                    };
                }

                // ── failure ──
                const err = outcome.error;

                if (outcome.budget) {
                    // the global time budget ran out — stop the whole chain
                    log.push({ model: outcome.attempt.id, status: 'budget', ms: 0 });
                    break;
                }

                if (outcome.attempt.superseded && !outcome.attempt.timedOut) {
                    // lost the race → the model is not to blame
                    log.push({ model: outcome.attempt.id, status: 'lost', ms: 0 });
                    if (!inFlight.size) break;
                    continue;
                }

                const cls = outcome.attempt.timedOut ? 'timeout' : classifyError(err);
                if (!outcome.attempt.superseded) {
                    recordFailure(outcome.attempt.key, err, cls);
                    consecutiveFails++;
                }
                lastError = err;
                log.push({ model: outcome.attempt.id, status: 'error', error: String((err && err.message) || cls).slice(0, 200), cls: cls });

                // an auth / quota error is provider-wide → retrying other models
                // would only burn quota
                if (cls === 'auth') break;

                if (consecutiveFails >= BREAKER_LIMIT) {
                    log.push({ model: '—', status: 'breaker', reason: BREAKER_LIMIT + ' consecutive failures' });
                    break;
                }

                if (budgetExpired || Date.now() >= deadline) {
                    // the request ran out of its time budget
                    budgetExpired = true;
                    break;
                }

                if (!inFlight.size) {
                    // start the next candidate
                    let started = false;
                    while (nextIndex < list.length) {
                        const cand = list[nextIndex];
                        const idx = nextIndex++;
                        if (!cand || cand.disabled) continue;
                        if (isBenched(cand.key)) { log.push({ model: cand.id, status: 'skipped', reason: 'benched' }); continue; }
                        launch(idx);
                        started = true;
                        break;
                    }
                    if (!started) break;
                    scheduleHedge();
                }
            }
        } finally {
            if (deadlineTimer) clearTimeout(deadlineTimer);
            if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }
            // nothing may stay in flight when the loop ends
            for (const entry of inFlight.values()) {
                entry.attempt.superseded = true;
                try { entry.controller.abort('done'); } catch (e) { /* ignore */ }
            }
            inFlight.clear();
            flush();
        }

        const finalError = lastError || new Error('Every model in the chain failed.');
        finalError.router = true;
        finalError.attempts = log;
        finalError.budgetExpired = budgetExpired;
        throw finalError;
    }

    // ── Per-model enable / disable ─────────────────────────────────────────
    function setModelDisabled(provider, modelId, disabled) {
        const p = String(provider || 'unknown');
        if (!store.disabled[p]) store.disabled[p] = {};
        store.disabled[p][String(modelId)] = !!disabled;
        save(true);
    }

    function isModelDisabled(provider, modelId) {
        const p = String(provider || 'unknown');
        return !!(store.disabled[p] && store.disabled[p][String(modelId)]);
    }

    // ── Reporting ──────────────────────────────────────────────────────────
    /** A compact snapshot for the router panel in the settings modal. */
    function snapshot(provider, models, options = {}) {
        const chain = buildChain(provider, models, options);
        let tracked = 0, totalOk = 0, totalFail = 0;
        const list = Array.isArray(models) ? models : [];
        for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            const id = typeof raw === 'string' ? raw : (raw && raw.id);
            if (!id) continue;
            const entry = peekEntry(statKey(provider, id));
            if (!entry) continue;
            tracked++;
            totalOk += entry.totalOk || 0;
            totalFail += entry.totalFail || 0;
        }
        const attempts = totalOk + totalFail;
        return {
            chain: chain,
            tracked: tracked,
            totalOk: totalOk,
            totalFail: totalFail,
            successRate: attempts ? totalOk / attempts : null
        };
    }

    /** Wipes every learned statistic (the user's explicit "Reset stats" action). */
    function resetStats() {
        store = { v: 1, models: {}, disabled: store.disabled || {} };
        flush();
    }

    /** Removes the whole router store — used by "Erase All Local Data". */
    function clearAll() {
        try { localStorage.removeItem(STATS_KEY); } catch (e) { /* storage blocked */ }
        store = { v: 1, models: {}, disabled: {} };
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    }

    // ── Boot ───────────────────────────────────────────────────────────────
    load();

    return {
        // storage
        STATS_KEY: STATS_KEY,
        STRATEGIES: STRATEGIES,
        BREAKER_LIMIT: BREAKER_LIMIT,
        DEFAULT_BUDGET_MS: DEFAULT_BUDGET_MS,
        DEFAULT_ATTEMPT_TIMEOUT_MS: DEFAULT_ATTEMPT_TIMEOUT_MS,
        DEFAULT_HEDGE_MS: DEFAULT_HEDGE_MS,

        // scoring
        aggregate: aggregate,
        reliabilityOf: reliabilityOf,
        speedScore: speedScore,
        speedHeuristic: speedHeuristic,
        intelligenceHeuristic: intelligenceHeuristic,
        combineScore: combineScore,
        classifyError: classifyError,
        decayWeight: decayWeight,

        // state
        penaltyOf: penaltyOf,
        isBenched: isBenched,
        isBreakerOpen: isBreakerOpen,
        benchRemaining: benchRemaining,
        recordSuccess: recordSuccess,
        recordFailure: recordFailure,

        // routing
        buildChain: buildChain,
        runChain: runChain,

        // management
        setModelDisabled: setModelDisabled,
        isModelDisabled: isModelDisabled,
        snapshot: snapshot,
        resetStats: resetStats,
        clearAll: clearAll,
        flush: flush,
        statKey: statKey
    };
})();

if (typeof window !== 'undefined') {
    window.AIModelRouter = AIModelRouter;
}
