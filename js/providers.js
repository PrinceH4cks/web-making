/* ════════════════════════════════════════════════════════════════════════
   AI PROVIDER CATALOGUE — Master Web IDE Ultra
   Provider list, base URLs, "where do I get the key" links, free-tier limits,
   per-model pricing and rate-limit header specs.
   Ported from FreeLLMAPI (25 seeded models, 83 providers).
   Pure data — nothing here ever phones home.
   ════════════════════════════════════════════════════════════════════════ */
const AIProviderCatalog = (function () {
    const PROVIDERS = [
        {
            "id": "aclide",
            "name": "ACLIDE",
            "baseUrl": "https://aclide.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://aclide.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "agnes",
            "name": "Agnes AI",
            "baseUrl": "https://apihub.agnes-ai.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://agnes-ai.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "aihorde",
            "name": "AI Horde",
            "baseUrl": "https://oai.aihorde.net/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://aihorde.net/register",
            "homepage": "https://aihorde.net",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "ainative",
            "name": "AINative Studio",
            "baseUrl": "https://api.ainative.studio/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://ainative.studio",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "aion",
            "name": "Aion Labs",
            "baseUrl": "https://api.aionlabs.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://aionlabs.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "radeon",
            "name": "AMD Radeon Cloud",
            "baseUrl": "https://developer.amd.com.cn/radeon/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://developer.amd.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "anthropic",
            "name": "Anthropic",
            "baseUrl": "https://api.anthropic.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.anthropic.com/settings/keys",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "anyapi",
            "name": "AnyAPI",
            "baseUrl": "https://api.anyapi.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://anyapi.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "airforce",
            "name": "Api.Airforce",
            "baseUrl": "https://api.airforce/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://airforce.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "apinex",
            "name": "APINex",
            "baseUrl": "https://api.apinex.bond/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://apinex.bond",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "bai",
            "name": "B.AI",
            "baseUrl": "https://api.b.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.b.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "qianfan",
            "name": "Baidu Qianfan",
            "baseUrl": "https://qianfan.baidubce.com/v2",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.bce.baidu.com/qianfan/ais/console/apikey",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "bazaarlink",
            "name": "BazaarLink",
            "baseUrl": "https://bazaarlink.ai/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://bazaarlink.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "beatapi",
            "name": "BeatAPI",
            "baseUrl": "https://api.beatapi.io/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://beatapi.io",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "blaze",
            "name": "BlazeAPI",
            "baseUrl": "https://api.blazeapi.org/paid/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://blazeapi.org",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "blockrun",
            "name": "BlockRun",
            "baseUrl": "https://api.blockrun.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://blockrun.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "cerebras",
            "name": "Cerebras",
            "baseUrl": "https://api.cerebras.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://cloud.cerebras.ai",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "clod",
            "name": "CLōD",
            "baseUrl": "https://api.clod.io/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://clod.io",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "cloudflare",
            "name": "Cloudflare Workers AI",
            "baseUrl": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
            "kind": "workers",
            "keyless": false,
            "keyUrl": "https://dash.cloudflare.com/?to=/:account/ai",
            "homepage": "https:/",
            "tier": "Free daily allowance",
            "probe": null
        },
        {
            "id": "cohere",
            "name": "Cohere",
            "baseUrl": "https://api.cohere.ai/compatibility/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://dashboard.cohere.com/api-keys",
            "homepage": "https:/",
            "tier": "Trial tier",
            "probe": null
        },
        {
            "id": "custom",
            "name": "Custom (OpenAI-compatible)",
            "baseUrl": "",
            "kind": "custom",
            "keyless": false,
            "keyUrl": "",
            "homepage": "",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "deepseek",
            "name": "DeepSeek",
            "baseUrl": "https://api.deepseek.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.deepseek.com/api_keys",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "dreamprompting",
            "name": "DreamPrompting",
            "baseUrl": "https://dreamprompting.com/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://dreamprompting.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "electronhub",
            "name": "ElectronHub",
            "baseUrl": "https://api.electronhub.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://electronhub.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "exa",
            "name": "Exa",
            "baseUrl": "https://api.exa.ai",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://dashboard.exa.ai/api-keys",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "experiential",
            "name": "Experiential Labs",
            "baseUrl": "https://api.experientiallabs.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://experientiallabs.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "firecrawl",
            "name": "Firecrawl",
            "baseUrl": "https://api.firecrawl.dev/v2",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://www.firecrawl.dev",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "fireworks",
            "name": "Fireworks AI",
            "baseUrl": "https://api.fireworks.ai/inference/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://fireworks.ai/api-keys",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "freeai",
            "name": "Free.ai",
            "baseUrl": "https://api.free.ai",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://free.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "github",
            "name": "GitHub Models",
            "baseUrl": "https://models.github.ai/inference",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://github.com/settings/tokens",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "gizmo",
            "name": "Gizmo",
            "baseUrl": "https://api.gizmoplatforms.com/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://gizmoplatforms.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "google",
            "name": "Google AI Studio",
            "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
            "kind": "gemini",
            "keyless": false,
            "keyUrl": "https://aistudio.google.com/app/apikey",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "groq",
            "name": "Groq",
            "baseUrl": "https://api.groq.com/openai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.groq.com/keys",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "huggingface",
            "name": "HuggingFace Router",
            "baseUrl": "https://router.huggingface.co/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://huggingface.co/settings/tokens",
            "homepage": "https:/",
            "tier": "Free credits (~$0.10/mo)",
            "probe": null
        },
        {
            "id": "xfyun",
            "name": "iFlytek Spark",
            "baseUrl": "https://spark-api-open.xf-yun.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.xfyun.cn/services/iat",
            "homepage": "https:/",
            "tier": "Free daily quota",
            "probe": null
        },
        {
            "id": "inferbase",
            "name": "Inferbase",
            "baseUrl": "https://api.inferbase.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://inferbase.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "kilo",
            "name": "Kilo Gateway",
            "baseUrl": "https://api.kilo.ai/api/gateway/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://kilo.ai",
            "homepage": "https://kilo.ai",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "linkup",
            "name": "Linkup",
            "baseUrl": "https://api.linkup.so/v1",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://app.linkup.so",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "llm7",
            "name": "LLM7",
            "baseUrl": "https://api.llm7.io/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://llm7.io",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "llmtr",
            "name": "LLMTR",
            "baseUrl": "https://llmtr.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://llmtr.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "logfare",
            "name": "Logfare",
            "baseUrl": "https://logfare.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://logfare.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "longcat",
            "name": "LongCat",
            "baseUrl": "https://api.longcat.chat/openai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://longcat.chat/platform",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "lucidity",
            "name": "Lucidity Composite",
            "baseUrl": "https://composite.lucidity.sh/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://lucidity.sh",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "minimax",
            "name": "MiniMax",
            "baseUrl": "https://api.minimax.chat/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.minimaxi.com/user-center/basic-information/interface-key",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "mistral",
            "name": "Mistral",
            "baseUrl": "https://api.mistral.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.mistral.ai/api-keys/",
            "homepage": "https:/",
            "tier": "Experiment tier (free)",
            "probe": null
        },
        {
            "id": "modelscope",
            "name": "ModelScope",
            "baseUrl": "https://api-inference.modelscope.cn/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://modelscope.cn/my/myaccesstoken",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "moondream",
            "name": "Moondream",
            "baseUrl": "https://api.moondream.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://moondream.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "moonshot",
            "name": "Moonshot AI (Kimi)",
            "baseUrl": "https://api.moonshot.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.moonshot.ai/console/api-keys",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "nara",
            "name": "NaraRouter",
            "baseUrl": "https://router.bynara.id/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://bynara.id",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "navy",
            "name": "NavyAI",
            "baseUrl": "https://api.navy/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://navy.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "nvidia",
            "name": "NVIDIA NIM",
            "baseUrl": "https://integrate.api.nvidia.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://build.nvidia.com",
            "homepage": "https:/",
            "tier": "Free credits on request",
            "probe": null
        },
        {
            "id": "ollama",
            "name": "Ollama Cloud",
            "baseUrl": "https://ollama.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://ollama.com/settings/keys",
            "homepage": "https:/",
            "tier": "Free with account",
            "probe": null
        },
        {
            "id": "openai",
            "name": "OpenAI",
            "baseUrl": "https://api.openai.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.openai.com/api-keys",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "opencode",
            "name": "OpenCode Zen",
            "baseUrl": "https://opencode.ai/zen/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://opencode.ai/zen",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "openrouter",
            "name": "OpenRouter",
            "baseUrl": "https://openrouter.ai/api/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://openrouter.ai/settings/keys",
            "homepage": "https:/",
            "tier": "Free models + credits",
            "probe": {
                "url": "https://openrouter.ai/api/v1/key",
                "metric": "credits",
                "limitFields": [
                    "limit"
                ],
                "remainingFields": [
                    "limit_remaining"
                ]
            }
        },
        {
            "id": "orcarouter",
            "name": "OrcaRouter",
            "baseUrl": "https://api.orcarouter.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://orcarouter.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "ovh",
            "name": "OVH AI Endpoints",
            "baseUrl": "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://endpoints.kepler.ai.cloud.ovh.net",
            "homepage": "https://endpoints.kepler.ai.cloud.ovh.net",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "parallel",
            "name": "Parallel",
            "baseUrl": "https://api.parallel.ai/v1",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://platform.parallel.ai",
            "homepage": "https://platform.parallel.ai",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "perplexity",
            "name": "Perplexity",
            "baseUrl": "https://api.perplexity.ai",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://www.perplexity.ai/settings/api",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "plugsky",
            "name": "Plugsky",
            "baseUrl": "https://plugsky.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://plugsky.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "pollinations",
            "name": "Pollinations",
            "baseUrl": "https://gen.pollinations.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://gen.pollinations.ai/account/key",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "reka",
            "name": "Reka",
            "baseUrl": "https://api.reka.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://platform.reka.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "requesty",
            "name": "Requesty",
            "baseUrl": "https://router.requesty.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://app.requesty.ai/api-keys",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        },
        {
            "id": "router9",
            "name": "Router9",
            "baseUrl": "https://api.router9.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://router9.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "routeway",
            "name": "Routeway",
            "baseUrl": "https://api.routeway.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://routeway.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "sail",
            "name": "Sail Research",
            "baseUrl": "https://api.sailresearch.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://sailresearch.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "sambanova",
            "name": "SambaNova",
            "baseUrl": "https://api.sambanova.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://cloud.sambanova.ai/apis",
            "homepage": "https:/",
            "tier": "Free tier",
            "probe": null
        },
        {
            "id": "sealion",
            "name": "SEA-LION",
            "baseUrl": "https://api.sea-lion.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://sealion.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "septor",
            "name": "Septor Labs",
            "baseUrl": "https://api.septorlabs.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://septorlabs.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "serpsearch",
            "name": "SerpSearch",
            "baseUrl": "https://api.serpsearch.com/api/v1",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://serpsearch.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "siliconflow",
            "name": "SiliconFlow",
            "baseUrl": "https://api.siliconflow.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://cloud.siliconflow.cn",
            "homepage": "https:/",
            "tier": "Gift credit on signup",
            "probe": {
                "url": "https://api.siliconflow.com/v1/user/info",
                "metric": "credits",
                "limitFields": [],
                "remainingFields": [
                    "totalBalance",
                    "balance"
                ]
            }
        },
        {
            "id": "simplellm",
            "name": "SimpleLLM",
            "baseUrl": "https://api.simplellm.eu/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://simplellm.eu",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "speechify",
            "name": "Speechify",
            "baseUrl": "https://api.speechify.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://speechify.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "speka",
            "name": "Speka",
            "baseUrl": "https://speka.me/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://speka.me",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "tavily",
            "name": "Tavily",
            "baseUrl": "https://api.tavily.com",
            "kind": "search",
            "keyless": false,
            "keyUrl": "https://app.tavily.com/home",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "together",
            "name": "Together AI",
            "baseUrl": "https://api.together.xyz/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://api.together.xyz/settings/api-keys",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "typhoon",
            "name": "Typhoon",
            "baseUrl": "https://api.opentyphoon.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://opentyphoon.ai",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "unorouter",
            "name": "UnoRouter",
            "baseUrl": "https://api.unorouter.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://unorouter.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "volcengine",
            "name": "Volcengine Ark",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
            "homepage": "https:/",
            "tier": "Free token grant",
            "probe": null
        },
        {
            "id": "waterfall",
            "name": "Waterfall",
            "baseUrl": "https://api.getwaterfall.org/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://getwaterfall.org",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "xai",
            "name": "xAI (Grok)",
            "baseUrl": "https://api.x.ai/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://console.x.ai",
            "homepage": "https:/",
            "tier": "Pay per token",
            "probe": null
        },
        {
            "id": "xkiro",
            "name": "xKiro",
            "baseUrl": "https://api.xkiro.com/v1",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://xkiro.com",
            "homepage": "https:/",
            "tier": "Free / paid tier",
            "probe": null
        },
        {
            "id": "zhipu",
            "name": "Zhipu AI",
            "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
            "kind": "openai",
            "keyless": false,
            "keyUrl": "https://open.bigmodel.cn/usercenter/apikeys",
            "homepage": "https:/",
            "tier": "Free tier (no card)",
            "probe": null
        }
    ];

    const MODELS = [
        {
            "provider": "opencode",
            "id": "deepseek-chat",
            "name": "DeepSeek V3 (Chat)",
            "intelligence": 0.95,
            "speed": 9,
            "size": "671B MoE",
            "rpm": 60,
            "rpd": 1000,
            "tpm": 100000,
            "tpd": null,
            "budget": "~10M",
            "ctx": 65536
        },
        {
            "provider": "opencode",
            "id": "deepseek-reasoner",
            "name": "DeepSeek R1 (Reasoner)",
            "intelligence": 1,
            "speed": 7,
            "size": "671B Reasoning",
            "rpm": 30,
            "rpd": 500,
            "tpm": 60000,
            "tpd": null,
            "budget": "~5M",
            "ctx": 65536
        },
        {
            "provider": "opencode",
            "id": "qwen2.5-coder-32b-instruct",
            "name": "Qwen 2.5 Coder 32B",
            "intelligence": 0.92,
            "speed": 9,
            "size": "32B Coder",
            "rpm": 60,
            "rpd": 1000,
            "tpm": 100000,
            "tpd": null,
            "budget": "~10M",
            "ctx": 32768
        },
        {
            "provider": "opencode",
            "id": "meta-llama/llama-3.3-70b-instruct",
            "name": "Llama 3.3 70B Instruct",
            "intelligence": 0.94,
            "speed": 8,
            "size": "70B",
            "rpm": 60,
            "rpd": 1000,
            "tpm": 100000,
            "tpd": null,
            "budget": "~10M",
            "ctx": 131072
        },
        {
            "provider": "opencode",
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o Mini",
            "intelligence": 0.9,
            "speed": 9,
            "size": "Compact",
            "rpm": 60,
            "rpd": 1000,
            "tpm": 100000,
            "tpd": null,
            "budget": "~5M",
            "ctx": 128000
        },
        {
            "provider": "opencode",
            "id": "claude-3-5-sonnet",
            "name": "Claude 3.5 Sonnet",
            "intelligence": 0.98,
            "speed": 8,
            "size": "Frontier",
            "rpm": 30,
            "rpd": 500,
            "tpm": 60000,
            "tpd": null,
            "budget": "~5M",
            "ctx": 200000
        },
        {
            "provider": "google",
            "id": "gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "intelligence": 1,
            "speed": 8,
            "size": "Frontier",
            "rpm": 5,
            "rpd": 100,
            "tpm": 250000,
            "tpd": null,
            "budget": "~12M",
            "ctx": 1048576
        },
        {
            "provider": "google",
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "intelligence": 4,
            "speed": 5,
            "size": "Large",
            "rpm": 10,
            "rpd": 20,
            "tpm": 250000,
            "tpd": null,
            "budget": "~3M",
            "ctx": 1048576
        },
        {
            "provider": "google",
            "id": "gemini-2.5-flash-lite",
            "name": "Gemini 2.5 Flash-Lite",
            "intelligence": 8,
            "speed": 3,
            "size": "Medium",
            "rpm": 15,
            "rpd": 1000,
            "tpm": 250000,
            "tpd": null,
            "budget": "~120M",
            "ctx": 1048576
        },
        {
            "provider": "openrouter",
            "id": "nvidia/nemotron-3-super-120b-a12b:free",
            "name": "Nemotron 3 Super 120B (free)",
            "intelligence": 3,
            "speed": 8,
            "size": "Medium",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 1048576
        },
        {
            "provider": "openrouter",
            "id": "google/gemma-4-31b-it:free",
            "name": "Gemma 4 31B (free)",
            "intelligence": 3,
            "speed": 9,
            "size": "Large",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 262144
        },
        {
            "provider": "openrouter",
            "id": "google/gemma-4-26b-a4b-it:free",
            "name": "Gemma 4 26B-A4B (free)",
            "intelligence": 3,
            "speed": 9,
            "size": "Large",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 262144
        },
        {
            "provider": "openrouter",
            "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            "name": "Nemotron 3 Nano 30B Reasoning (free)",
            "intelligence": 4,
            "speed": 9,
            "size": "Medium",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 262144
        },
        {
            "provider": "openrouter",
            "id": "cohere/north-mini-code:free",
            "name": "North Mini Code (free)",
            "intelligence": 3,
            "speed": 9,
            "size": "Medium",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 256000
        },
        {
            "provider": "openrouter",
            "id": "dots-studio/dots-3-note-preview:free",
            "name": "Dots3 Note Preview (free)",
            "intelligence": 5,
            "speed": 7,
            "size": "Frontier",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 512000
        },
        {
            "provider": "openrouter",
            "id": "liquid/lfm-2.5-2.6b:free",
            "name": "LFM2.5 2.6B (free)",
            "intelligence": 2,
            "speed": 10,
            "size": "Medium",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 33000
        },
        {
            "provider": "openrouter",
            "id": "nvidia/nemotron-3.5-content-safety:free",
            "name": "Nemotron 3.5 Content Safety (free)",
            "intelligence": 2,
            "speed": 10,
            "size": "Small",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 128000
        },
        {
            "provider": "openrouter",
            "id": "nvidia/nemotron-3.5-lightning:free",
            "name": "Nemotron 3.5 Lightning (free)",
            "intelligence": 3,
            "speed": 10,
            "size": "Medium",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 1048576
        },
        {
            "provider": "openrouter",
            "id": "poolside/laguna-s-2.1:free",
            "name": "Poolside Laguna S 2.1 (free)",
            "intelligence": 3,
            "speed": 8,
            "size": "Large",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 262144
        },
        {
            "provider": "openrouter",
            "id": "poolside/laguna-xs-2.1:free",
            "name": "Poolside Laguna XS 2.1 (free)",
            "intelligence": 3,
            "speed": 9,
            "size": "Large",
            "rpm": 20,
            "rpd": 200,
            "tpm": null,
            "tpd": null,
            "budget": "~6M",
            "ctx": 131072
        },
        {
            "provider": "cerebras",
            "id": "qwen-3-coder-480b",
            "name": "Qwen3-Coder 480B",
            "intelligence": 2,
            "speed": 1,
            "size": "Frontier",
            "rpm": 30,
            "rpd": null,
            "tpm": 60000,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 131072
        },
        {
            "provider": "cerebras",
            "id": "llama-4-maverick-17b-128e-instruct",
            "name": "Llama 4 Maverick",
            "intelligence": 3,
            "speed": 1,
            "size": "Frontier",
            "rpm": 30,
            "rpd": null,
            "tpm": 60000,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 131072
        },
        {
            "provider": "cerebras",
            "id": "qwen3-235b",
            "name": "Qwen3 235B",
            "intelligence": 3,
            "speed": 1,
            "size": "Large",
            "rpm": 30,
            "rpd": null,
            "tpm": 60000,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 8192
        },
        {
            "provider": "cerebras",
            "id": "gpt-oss-120b",
            "name": "GPT-OSS 120B",
            "intelligence": 3,
            "speed": 1,
            "size": "Large",
            "rpm": 30,
            "rpd": null,
            "tpm": 60000,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 131072
        },
        {
            "provider": "github",
            "id": "openai/gpt-5",
            "name": "GPT-5 (GitHub)",
            "intelligence": 1,
            "speed": 7,
            "size": "Frontier",
            "rpm": 10,
            "rpd": 50,
            "tpm": null,
            "tpd": null,
            "budget": "~18M",
            "ctx": 128000
        },
        {
            "provider": "sambanova",
            "id": "Meta-Llama-3.3-70B-Instruct",
            "name": "Llama 3.3 70B",
            "intelligence": 6,
            "speed": 9,
            "size": "Large",
            "rpm": 20,
            "rpd": null,
            "tpm": null,
            "tpd": 200000,
            "budget": "~6M",
            "ctx": 8192
        },
        {
            "provider": "mistral",
            "id": "mistral-large-latest",
            "name": "Mistral Large 3",
            "intelligence": 7,
            "speed": 8,
            "size": "Large",
            "rpm": 2,
            "rpd": null,
            "tpm": 500000,
            "tpd": null,
            "budget": "~50-100M",
            "ctx": 131072
        },
        {
            "provider": "mistral",
            "id": "magistral-medium-latest",
            "name": "Magistral Medium",
            "intelligence": 4,
            "speed": 8,
            "size": "Large",
            "rpm": 2,
            "rpd": null,
            "tpm": 500000,
            "tpd": null,
            "budget": "~50-100M",
            "ctx": 40000
        },
        {
            "provider": "mistral",
            "id": "codestral-latest",
            "name": "Codestral",
            "intelligence": 6,
            "speed": 6,
            "size": "Medium",
            "rpm": 2,
            "rpd": null,
            "tpm": 500000,
            "tpd": null,
            "budget": "~50-100M",
            "ctx": 32000
        },
        {
            "provider": "groq",
            "id": "llama-3.3-70b-versatile",
            "name": "Llama 3.3 70B",
            "intelligence": 9,
            "speed": 2,
            "size": "Medium",
            "rpm": 30,
            "rpd": 1000,
            "tpm": 6000,
            "tpd": 500000,
            "budget": "~15M",
            "ctx": 131072
        },
        {
            "provider": "groq",
            "id": "llama-4-scout-17b-16e-instruct",
            "name": "Llama 4 Scout",
            "intelligence": 10,
            "speed": 2,
            "size": "Medium",
            "rpm": 30,
            "rpd": 1000,
            "tpm": 6000,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 131072
        },
        {
            "provider": "nvidia",
            "id": "meta/llama-3.1-70b-instruct",
            "name": "Llama 3.1 70B (NV)",
            "intelligence": 11,
            "speed": 6,
            "size": "Large",
            "rpm": 40,
            "rpd": null,
            "tpm": null,
            "tpd": null,
            "budget": "credits-based",
            "ctx": 131072
        },
        {
            "provider": "cohere",
            "id": "command-r-plus-08-2024",
            "name": "Command R+ (08-2024)",
            "intelligence": 12,
            "speed": 11,
            "size": "Large",
            "rpm": 20,
            "rpd": 33,
            "tpm": null,
            "tpd": null,
            "budget": "~1-2M",
            "ctx": 131072
        },
        {
            "provider": "cloudflare",
            "id": "@cf/meta/llama-3.1-70b-instruct",
            "name": "Llama 3.1 70B (CF)",
            "intelligence": 13,
            "speed": 11,
            "size": "Medium",
            "rpm": null,
            "rpd": null,
            "tpm": null,
            "tpd": null,
            "budget": "~18-45M",
            "ctx": 131072
        },
        {
            "provider": "huggingface",
            "id": "accounts/fireworks/models/llama-v3p3-70b-instruct",
            "name": "Llama 3.3 70B (HF)",
            "intelligence": 14,
            "speed": 11,
            "size": "Medium",
            "rpm": null,
            "rpd": null,
            "tpm": null,
            "tpd": null,
            "budget": "~1-3M",
            "ctx": 131072
        },
        {
            "provider": "zhipu",
            "id": "glm-4.5-flash",
            "name": "GLM-4.5 Flash",
            "intelligence": 5,
            "speed": 4,
            "size": "Large",
            "rpm": null,
            "rpd": null,
            "tpm": null,
            "tpd": 1000000,
            "budget": "~30M",
            "ctx": 131072
        },
        {
            "provider": "moonshot",
            "id": "kimi-latest",
            "name": "Kimi Latest",
            "intelligence": 4,
            "speed": 8,
            "size": "Large",
            "rpm": 60,
            "rpd": null,
            "tpm": null,
            "tpd": 500000,
            "budget": "~15M",
            "ctx": 200000
        },
        {
            "provider": "minimax",
            "id": "MiniMax-M1",
            "name": "MiniMax M1",
            "intelligence": 5,
            "speed": 8,
            "size": "Large",
            "rpm": 20,
            "rpd": null,
            "tpm": 1000000,
            "tpd": null,
            "budget": "~30M",
            "ctx": 200000
        }
    ];

    const PRICING = {
        "cerebras": {
            "gpt-oss-120b": {
                "in": 0.039,
                "out": 0.18
            },
            "llama3.1-8b": {
                "in": 0.02,
                "out": 0.03
            },
            "qwen-3-235b-a22b-instruct-2507": {
                "in": 0.071,
                "out": 0.1
            },
            "zai-glm-4.7": {
                "in": 0.4,
                "out": 1.75
            },
            "qwen-3-coder-480b": {
                "in": 0.22,
                "out": 1.8
            },
            "llama-4-maverick-17b-128e-instruct": {
                "in": 0.15,
                "out": 0.6
            },
            "qwen3-235b": {
                "in": 0.455,
                "out": 1.82
            }
        },
        "cloudflare": {
            "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": {
                "in": 0.29,
                "out": 0.29
            },
            "@cf/google/gemma-4-26b-a4b-it": {
                "in": 0.06,
                "out": 0.33
            },
            "@cf/ibm-granite/granite-4.0-h-micro": {
                "in": 0.017,
                "out": 0.112
            },
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
                "in": 0.1,
                "out": 0.32
            },
            "@cf/meta/llama-4-scout-17b-16e-instruct": {
                "in": 0.08,
                "out": 0.3
            },
            "@cf/moonshotai/kimi-k2.6": {
                "in": 0.684,
                "out": 3.42
            },
            "@cf/nvidia/nemotron-3-120b-a12b": {
                "in": 0.09,
                "out": 0.45
            },
            "@cf/openai/gpt-oss-120b": {
                "in": 0.039,
                "out": 0.18
            },
            "@cf/qwen/qwen3-30b-a3b-fp8": {
                "in": 0.09,
                "out": 0.45
            },
            "@cf/zai-org/glm-4.7-flash": {
                "in": 0.06,
                "out": 0.4
            },
            "@cf/meta/llama-3.1-70b-instruct": {
                "in": 0.4,
                "out": 0.4
            }
        },
        "cohere": {
            "command-a-03-2025": {
                "in": 2.5,
                "out": 10
            },
            "command-a-reasoning-08-2025": {
                "in": 2.5,
                "out": 10
            },
            "command-r-08-2024": {
                "in": 0.15,
                "out": 0.6
            },
            "command-r-plus-08-2024": {
                "in": 2.5,
                "out": 10
            }
        },
        "google": {
            "gemini-2.5-flash": {
                "in": 0.3,
                "out": 2.5
            },
            "gemini-2.5-flash-lite": {
                "in": 0.1,
                "out": 0.4
            },
            "gemini-2.5-pro": {
                "in": 1.25,
                "out": 10
            },
            "gemini-3-flash-preview": {
                "in": 0.5,
                "out": 3
            },
            "gemini-3.1-flash-lite-preview": {
                "in": 0.25,
                "out": 1.5
            },
            "gemini-3.1-pro-preview": {
                "in": 2,
                "out": 12
            },
            "gemini-3.5-flash": {
                "in": 1.5,
                "out": 9
            },
            "gemma-4-26b-a4b-it": {
                "in": 0.06,
                "out": 0.33
            },
            "gemma-4-31b-it": {
                "in": 0.12,
                "out": 0.37
            }
        },
        "ollama": {
            "cogito-2.1:671b": {
                "in": 1.25,
                "out": 1.25
            },
            "deepseek-v3.2": {
                "in": 0.229,
                "out": 0.343
            },
            "devstral-2:123b": {
                "in": 0.4,
                "out": 2
            },
            "gemma4:31b": {
                "in": 0.12,
                "out": 0.37
            },
            "glm-4.7": {
                "in": 0.4,
                "out": 1.75
            },
            "gpt-oss:120b": {
                "in": 0.039,
                "out": 0.18
            },
            "gpt-oss:20b": {
                "in": 0.029,
                "out": 0.14
            },
            "kimi-k2-thinking": {
                "in": 0.6,
                "out": 2.5
            },
            "mistral-large-3:675b": {
                "in": 0.5,
                "out": 1.5
            },
            "qwen3-coder-next": {
                "in": 0.11,
                "out": 0.8
            },
            "qwen3-coder:480b": {
                "in": 0.22,
                "out": 1.8
            }
        },
        "openrouter": {
            "cognitivecomputations/dolphin-mistral-24b-venice-edition:free": {
                "in": null,
                "out": null
            },
            "google/gemma-4-26b-a4b-it:free": {
                "in": 0.06,
                "out": 0.33
            },
            "google/gemma-4-31b-it:free": {
                "in": 0.12,
                "out": 0.37
            },
            "meta-llama/llama-3.2-3b-instruct:free": {
                "in": 0.05,
                "out": 0.34
            },
            "moonshotai/kimi-k2.6:free": {
                "in": 0.684,
                "out": 3.42
            },
            "nvidia/nemotron-3-ultra-550b-a55b:free": {
                "in": 0.5,
                "out": 2.5
            },
            "nvidia/nemotron-nano-12b-v2-vl:free": {
                "in": null,
                "out": null
            },
            "liquid/lfm-2.5-1.2b-instruct:free": {
                "in": 0.01,
                "out": 0.04
            },
            "liquid/lfm-2.5-1.2b-thinking:free": {
                "in": 0.01,
                "out": 0.04
            },
            "meta-llama/llama-3.3-70b-instruct:free": {
                "in": 0.1,
                "out": 0.32
            },
            "nousresearch/hermes-3-llama-3.1-405b:free": {
                "in": 1,
                "out": 1
            },
            "nvidia/nemotron-3-nano-30b-a3b:free": {
                "in": 0.05,
                "out": 0.2
            },
            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": {
                "in": 0.05,
                "out": 0.2
            },
            "nvidia/nemotron-3-super-120b-a12b:free": {
                "in": 0.09,
                "out": 0.45
            },
            "nvidia/nemotron-nano-9b-v2:free": {
                "in": 0.04,
                "out": 0.16
            },
            "openai/gpt-oss-120b:free": {
                "in": 0.039,
                "out": 0.18
            },
            "openai/gpt-oss-20b:free": {
                "in": 0.029,
                "out": 0.14
            },
            "openrouter/owl-alpha": {
                "in": null,
                "out": null
            },
            "poolside/laguna-m.1:free": {
                "in": null,
                "out": null
            },
            "poolside/laguna-xs.2:free": {
                "in": null,
                "out": null
            },
            "qwen/qwen3-coder:free": {
                "in": 0.22,
                "out": 1.8
            },
            "qwen/qwen3-next-80b-a3b-instruct:free": {
                "in": 0.09,
                "out": 1.1
            },
            "z-ai/glm-4.5-air:free": {
                "in": 0.125,
                "out": 0.85
            },
            "deepseek/deepseek-v3.1:free": {
                "in": 0.21,
                "out": 0.79
            },
            "moonshotai/kimi-k2:free": {
                "in": 0.57,
                "out": 2.3
            }
        },
        "pollinations": {
            "openai-fast": {
                "in": 0.029,
                "out": 0.14
            }
        },
        "reka": {
            "reka-flash-3": {
                "in": 0.1,
                "out": 0.2
            },
            "reka-edge-2603": {
                "in": 0.1,
                "out": 0.1
            }
        }
    };

    const HEADER_SPECS = {
        "clod": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit",
                "remaining": "x-ratelimit-remaining",
                "reset": "x-ratelimit-reset",
                "strategy": "provider_reported"
            }
        ],
        "blaze": [
            {
                "metric": "tokens",
                "limit": "x-ratelimit-limit-tokens",
                "remaining": "x-ratelimit-remaining-tokens",
                "reset": "",
                "strategy": "provider_reported"
            }
        ],
        "router9": [
            {
                "metric": "credits",
                "limit": "x-credits-limit",
                "remaining": "x-credits-remaining",
                "reset": "x-credits-reset",
                "strategy": "provider_reported"
            }
        ],
        "septor": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit",
                "remaining": "x-ratelimit-remaining",
                "reset": "x-ratelimit-reset",
                "strategy": "provider_reported"
            }
        ],
        "electronhub": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit",
                "remaining": "x-ratelimit-remaining",
                "reset": "x-ratelimit-reset",
                "strategy": "provider_reported"
            }
        ],
        "groq": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit-requests",
                "remaining": "x-ratelimit-remaining-requests",
                "reset": "x-ratelimit-reset-requests",
                "strategy": "provider_reported"
            },
            {
                "metric": "tokens",
                "limit": "x-ratelimit-limit-tokens",
                "remaining": "x-ratelimit-remaining-tokens",
                "reset": "x-ratelimit-reset-tokens",
                "strategy": "provider_reported"
            }
        ],
        "cerebras": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit-requests-day",
                "remaining": "x-ratelimit-remaining-requests-day",
                "reset": "x-ratelimit-reset-requests-day",
                "strategy": "provider_reported"
            },
            {
                "metric": "tokens",
                "limit": "x-ratelimit-limit-tokens-minute",
                "remaining": "x-ratelimit-remaining-tokens-minute",
                "reset": "x-ratelimit-reset-tokens-minute",
                "strategy": "token_bucket"
            }
        ],
        "openrouter": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit-requests",
                "remaining": "x-ratelimit-remaining-requests",
                "reset": "x-ratelimit-reset-requests",
                "strategy": "provider_reported"
            },
            {
                "metric": "tokens",
                "limit": "x-ratelimit-limit-tokens",
                "remaining": "x-ratelimit-remaining-tokens",
                "reset": "x-ratelimit-reset-tokens",
                "strategy": "provider_reported"
            }
        ],
        "radeon": [
            {
                "metric": "requests",
                "limit": "x-ratelimit-limit-user-rpm",
                "remaining": "x-ratelimit-remaining-user-rpm",
                "reset": "x-ratelimit-reset",
                "strategy": "provider_reported"
            },
            {
                "metric": "credits",
                "limit": "x-ratelimit-limit-user-daily-usd",
                "remaining": "x-ratelimit-remaining-user-daily-usd",
                "reset": "x-ratelimit-reset-user-daily-usd",
                "strategy": "provider_reported"
            }
        ],
        "modelscope": [
            {
                "metric": "requests",
                "limit": "modelscope-ratelimit-requests-limit",
                "remaining": "modelscope-ratelimit-requests-remaining",
                "reset": "modelscope-ratelimit-requests-reset",
                "strategy": "provider_reported"
            }
        ]
    };

    /** every provider, alphabetically */
    function all() { return PROVIDERS.slice(); }

    /** look one provider up by id */
    function get(id) {
        for (let i = 0; i < PROVIDERS.length; i++) if (PROVIDERS[i].id === id) return PROVIDERS[i];
        return null;
    }

    /** providers that speak the OpenAI chat-completions protocol */
    function chatProviders() {
        return PROVIDERS.filter(p => p.kind === 'openai' || p.kind === 'gemini');
    }

    /** providers that need no API key at all */
    function keylessProviders() {
        return PROVIDERS.filter(p => p.keyless);
    }

    /** free-name search over id / name / base url */
    function search(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return PROVIDERS.slice();
        return PROVIDERS.filter(p =>
            p.id.toLowerCase().indexOf(q) !== -1 ||
            p.name.toLowerCase().indexOf(q) !== -1 ||
            String(p.baseUrl).toLowerCase().indexOf(q) !== -1 ||
            String(p.tier).toLowerCase().indexOf(q) !== -1);
    }

    /** the seeded free-tier models of one provider */
    function modelsFor(providerId) {
        return MODELS.filter(m => m.provider === providerId);
    }

    /** every seeded model, grouped for the "all AIs" view */
    function allModels() { return MODELS.slice(); }

    /** $/1M input & output price for a model, if known */
    function priceFor(providerId, modelId) {
        const table = PRICING[providerId];
        if (!table) return null;
        return table[modelId] || null;
    }

    /** rate-limit response headers we know how to read for a provider */
    function headerSpec(providerId) {
        return HEADER_SPECS[providerId] || null;
    }

    /** the monthly free-token budget of a model ("~6M", "credits-based", ...) */
    function budgetFor(providerId, modelId) {
        const m = MODELS.find(x => x.provider === providerId && x.id === modelId);
        return m ? m.budget : null;
    }

    /** parse "~6M" / "~1-2M" / "credits-based" into a number of tokens */
    function parseBudget(text) {
        if (typeof text !== 'string') return 0;
        const digits = text.replace(/[^0-9.]/g, '');
        if (!digits) return 0;
        const first = parseFloat(digits);
        if (isNaN(first)) return 0;
        if (/m/i.test(text)) return Math.round(first * 1000000);
        if (/k/i.test(text)) return Math.round(first * 1000);
        return Math.round(first);
    }

    return {
        PROVIDERS, MODELS, PRICING, HEADER_SPECS,
        all, get, chatProviders, keylessProviders, search,
        modelsFor, allModels, priceFor, headerSpec, budgetFor, parseBudget
    };
})();
