/* ==========================================================================
   Master Web IDE Ultra - Autonomous In-IDE AI Agent Studio
   ========================================================================== */

const AIAgent = (function() {
    const CONFIG_KEY = 'master_ide_ai_config';
    const CHAT_KEY = 'master_ide_ai_chat';

    const PROVIDERS = {
        gemini: {
            name: "Google Gemini",
            defaultModel: "gemini-2.5-flash",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/models"
        },
        deepseek: {
            name: "DeepSeek",
            defaultModel: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1"
        },
        groq: {
            name: "Groq (Ultra-Fast)",
            defaultModel: "llama-3.3-70b-versatile",
            baseUrl: "https://api.groq.com/openai/v1"
        },
        openrouter: {
            name: "OpenRouter",
            defaultModel: "anthropic/claude-3.5-haiku",
            baseUrl: "https://openrouter.ai/api/v1"
        },
        openai: {
            name: "OpenAI",
            defaultModel: "gpt-4o-mini",
            baseUrl: "https://api.openai.com/v1"
        },
        custom: {
            name: "Custom / OpenCode / Localhost (Ollama)",
            defaultModel: "qwen2.5-coder:7b",
            baseUrl: "http://localhost:11434/v1"
        }
    };

    let config = {
        provider: "gemini",
        apiKey: "",
        model: "gemini-2.5-flash",
        baseUrl: ""
    };

    let messages = [];
    let isBusy = false;

    // 🛠️ System Prompt for the Autonomous Agent
    const SYSTEM_PROMPT = `You are the Lead Autonomous AI Coding Agent inside Master Web IDE Ultra.
You have direct autonomous tool access to create, edit, delete, and read files in the user's project Virtual File System.
Your goal is to build modern, stunning, responsive, bug-free web projects (HTML5, modern CSS3, JavaScript, Tailwind, Canvas, etc.).

RULES:
1. Always write complete, production-ready code — NEVER write placeholder comments like "// rest of code here".
2. When creating multi-file projects, create "index.html", "css/style.css", and "js/main.js" (or other appropriate files) and link them correctly.
3. Be helpful, concise, and explain the changes you made after executing your tools.`;

    // 🛠️ Tool Definitions
    const TOOLS_SCHEMA = [
        {
            type: "function",
            function: {
                name: "create_or_update_file",
                description: "Create a new file or replace the entire content of an existing file in the project VFS.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative file path, e.g. 'index.html', 'css/style.css', 'js/main.js'"
                        },
                        content: {
                            type: "string",
                            description: "The complete code content of the file"
                        }
                    },
                    required: ["path", "content"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "read_file",
                description: "Read the current content of a file in the project to understand context before editing.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative path of the file to read"
                        }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "delete_file",
                description: "Delete a file from the project VFS.",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Relative path of the file to delete"
                        }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "list_project_files",
                description: "List all existing files currently in the project.",
                parameters: {
                    type: "object",
                    properties: {}
                }
            }
        }
    ];

    function init() {
        loadConfig();
        loadChat();
        renderChat();
        updateModelTag();
    }

    function loadConfig() {
        try {
            const saved = localStorage.getItem(CONFIG_KEY);
            if (saved) {
                config = { ...config, ...JSON.parse(saved) };
            }
        } catch (e) {}
    }

    function saveConfig() {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
            updateModelTag();
            App.showToast("AI Agent configuration saved!", "success");
        } catch (e) {}
    }

    function loadChat() {
        try {
            const saved = localStorage.getItem(CHAT_KEY);
            if (saved) {
                messages = JSON.parse(saved);
            } else {
                messages = [
                    {
                        role: "agent",
                        text: "👋 Hello! I am your Autonomous In-IDE AI Agent. Tell me what to build (e.g. *'Create a sleek glassmorphic weather app'*) and I will write files, organize folders, and update the live preview directly!"
                    }
                ];
            }
        } catch (e) {
            messages = [];
        }
    }

    function saveChat() {
        try {
            localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
        } catch (e) {}
    }

    function updateModelTag() {
        const tag = document.getElementById('ai-model-tag');
        if (tag) {
            tag.innerText = config.model || "Gemini 2.5";
            tag.title = `${PROVIDERS[config.provider]?.name || config.provider}: ${config.model}`;
        }
    }

    // 💬 CHAT RENDERING
    function renderChat() {
        const container = document.getElementById('ai-chat-stream');
        if (!container) return;

        container.innerHTML = messages.map(msg => {
            if (msg.role === 'user') {
                return `
                    <div class="ai-msg user">
                        <div class="ai-bubble">${escapeHtml(msg.text)}</div>
                    </div>
                `;
            } else {
                let badgesHtml = '';
                if (msg.toolsExecuted && msg.toolsExecuted.length > 0) {
                    badgesHtml = msg.toolsExecuted.map(t => `
                        <div class="ai-tool-badge ${t.action === 'delete' ? 'del' : ''}" onclick="App.openFile('${t.path}')">
                            <i class="fas fa-${t.action === 'delete' ? 'trash' : 'file-code'}"></i>
                            <span>${t.action === 'delete' ? 'Deleted' : 'Created/Updated'}: ${t.path}</span>
                        </div>
                    `).join('');
                }

                return `
                    <div class="ai-msg agent">
                        <div class="ai-bubble">
                            ${badgesHtml}
                            <div>${formatMarkdown(msg.text)}</div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    // 🚀 EXECUTE TOOLS ON VFS
    function executeTool(name, args) {
        if (name === "create_or_update_file") {
            const { path, content } = args;
            VFS.set(path, content);
            App.renderExplorer();
            App.updatePreview();
            if (App.getCurrentFile() === path) {
                EditorController.setContent(content, VFS.detectType(path));
            }
            return { status: "success", message: `Successfully wrote file: ${path}` };
        }

        if (name === "delete_file") {
            const { path } = args;
            const res = VFS.remove(path);
            App.renderExplorer();
            App.updatePreview();
            return { status: res ? "success" : "not_found", message: `File deleted: ${path}` };
        }

        if (name === "read_file") {
            const { path } = args;
            const file = VFS.get(path);
            if (!file) return { error: `File '${path}' not found` };
            return { path: path, content: file.content };
        }

        if (name === "list_project_files") {
            return { files: VFS.getAllPaths() };
        }

        return { error: `Unknown tool: ${name}` };
    }

    // 🚀 SEND PROMPT / RUN AGENT
    async function sendMessage(promptText) {
        promptText = promptText || document.getElementById('ai-prompt-input')?.value.trim();
        if (!promptText || isBusy) return;

        // Verify API key
        if (!config.apiKey && config.provider !== 'custom') {
            App.showToast("Please configure your API Key first!", "error");
            openSettings();
            return;
        }

        // Add user message
        messages.push({ role: "user", text: promptText });
        renderChat();

        const inputEl = document.getElementById('ai-prompt-input');
        if (inputEl) inputEl.value = '';

        setBusy(true);

        try {
            if (config.provider === 'gemini') {
                await runGeminiAgent(promptText);
            } else {
                await runOpenAIAgent(promptText);
            }
        } catch (err) {
            messages.push({
                role: "agent",
                text: `❌ **Error:** ${err.message}\n\nPlease verify your API key and network connection in AI Settings.`
            });
            renderChat();
        } finally {
            setBusy(false);
            saveChat();
        }
    }

    // 🤖 RUN GOOGLE GEMINI AGENT
    async function runGeminiAgent(userPrompt) {
        const apiKey = config.apiKey.trim();
        const model = config.model || "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Gemini Function Declarations
        const geminiTools = [
            {
                functionDeclarations: [
                    {
                        name: "create_or_update_file",
                        description: "Create or overwrite a file in the project VFS",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "Relative file path" },
                                content: { type: "STRING", description: "Complete file content" }
                            },
                            required: ["path", "content"]
                        }
                    },
                    {
                        name: "read_file",
                        description: "Read content of a project file",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "File path" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "delete_file",
                        description: "Delete a file",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                path: { type: "STRING", description: "File path" }
                            },
                            required: ["path"]
                        }
                    },
                    {
                        name: "list_project_files",
                        description: "List all files in project",
                        parameters: { type: "OBJECT", properties: {} }
                    }
                ]
            }
        ];

        // Format conversation history for Gemini
        let contents = [];
        const existingFiles = VFS.getAllPaths().join(', ');
        
        contents.push({
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n\nCurrent files in project: [${existingFiles}]\n\nUser instruction: ${userPrompt}` }]
        });

        let executedTools = [];
        let finalResponseText = "";
        let iterations = 0;
        const MAX_ITERATIONS = 6;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: contents,
                    tools: geminiTools
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const candidate = data.candidates?.[0];
            if (!candidate) throw new Error("No response generated by Gemini.");

            const contentPart = candidate.content?.parts || [];
            contents.push(candidate.content);

            // Check for function calls
            const functionCalls = contentPart.filter(p => p.functionCall);

            if (functionCalls.length > 0) {
                const responseParts = [];

                for (const call of functionCalls) {
                    const fn = call.functionCall;
                    const result = executeTool(fn.name, fn.args || {});
                    
                    if (fn.name === "create_or_update_file") {
                        executedTools.push({ action: 'create', path: fn.args.path });
                    } else if (fn.name === "delete_file") {
                        executedTools.push({ action: 'delete', path: fn.args.path });
                    }

                    responseParts.push({
                        functionResponse: {
                            name: fn.name,
                            response: { result: result }
                        }
                    });
                }

                contents.push({
                    role: "user",
                    parts: responseParts
                });
            } else {
                // Final text response
                finalResponseText = contentPart.map(p => p.text || '').join('');
                break;
            }
        }

        messages.push({
            role: "agent",
            text: finalResponseText || "Finished applying changes to your project!",
            toolsExecuted: executedTools
        });
        renderChat();
    }

    // 🤖 RUN OPENAI / OPENCODE / GROQ / DEEPSEEK AGENT
    async function runOpenAIAgent(userPrompt) {
        const apiKey = config.apiKey.trim();
        const providerMeta = PROVIDERS[config.provider] || PROVIDERS.openai;
        const baseUrl = (config.baseUrl || providerMeta.baseUrl).replace(/\/+$/, '');
        const model = config.model || providerMeta.defaultModel;
        const url = `${baseUrl}/chat/completions`;

        const existingFiles = VFS.getAllPaths().join(', ');
        let conversation = [
            {
                role: "system",
                content: `${SYSTEM_PROMPT}\n\nCurrent files in project: [${existingFiles}]`
            },
            {
                role: "user",
                content: userPrompt
            }
        ];

        let executedTools = [];
        let finalResponseText = "";
        let iterations = 0;
        const MAX_ITERATIONS = 6;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const headers = {
                "Content-Type": "application/json"
            };
            if (apiKey) {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const res = await fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: model,
                    messages: conversation,
                    tools: TOOLS_SCHEMA,
                    tool_choice: "auto"
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error("No response received from AI model.");

            const message = choice.message;
            conversation.push(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    const fnName = toolCall.function.name;
                    let fnArgs = {};
                    try {
                        fnArgs = JSON.parse(toolCall.function.arguments);
                    } catch(e) {}

                    const result = executeTool(fnName, fnArgs);

                    if (fnName === "create_or_update_file") {
                        executedTools.push({ action: 'create', path: fnArgs.path });
                    } else if (fnName === "delete_file") {
                        executedTools.push({ action: 'delete', path: fnArgs.path });
                    }

                    conversation.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result)
                    });
                }
            } else {
                finalResponseText = message.content || "";
                break;
            }
        }

        messages.push({
            role: "agent",
            text: finalResponseText || "Project successfully updated with your request!",
            toolsExecuted: executedTools
        });
        renderChat();
    }

    // 🐛 AUTO-FIX RUNTIME ERRORS REPORTED FROM CONSOLE
    function fixError(errorMsg) {
        togglePanel(true);
        const prompt = `Fix this runtime error in my project:\n"${errorMsg}"\nInspect the affected files, fix the root cause, and update the project code.`;
        sendMessage(prompt);
    }

    function clearChat() {
        messages = [
            {
                role: "agent",
                text: "Chat cleared. What would you like to build or modify next?"
            }
        ];
        saveChat();
        renderChat();
    }

    function setBusy(busy) {
        isBusy = busy;
        const thinking = document.getElementById('ai-thinking');
        const sendBtn = document.getElementById('ai-send-btn');
        if (thinking) thinking.classList.toggle('active', busy);
        if (sendBtn) {
            sendBtn.innerHTML = busy ? `<i class="fas fa-spinner fa-spin"></i>` : `<i class="fas fa-paper-plane"></i>`;
            sendBtn.disabled = busy;
        }
    }

    function togglePanel(forceOpen) {
        const panel = document.getElementById('ai-studio-panel');
        if (!panel) return;

        if (forceOpen !== undefined) {
            panel.classList.toggle('active', forceOpen);
        } else {
            panel.classList.toggle('active');
        }

        if (panel.classList.contains('active')) {
            setTimeout(() => document.getElementById('ai-prompt-input')?.focus(), 100);
        }
    }

    function openSettings() {
        const modal = document.getElementById('ai-settings-modal');
        if (!modal) return;

        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const modelInput = document.getElementById('ai-model-input');
        const baseUrlInput = document.getElementById('ai-base-url-input');

        if (providerSelect) providerSelect.value = config.provider;
        if (apiKeyInput) apiKeyInput.value = config.apiKey;
        if (modelInput) modelInput.value = config.model;
        if (baseUrlInput) baseUrlInput.value = config.baseUrl;

        updateProviderFields();
        modal.classList.add('active');
    }

    function saveSettingsFromModal() {
        const providerSelect = document.getElementById('ai-provider-select');
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const modelInput = document.getElementById('ai-model-input');
        const baseUrlInput = document.getElementById('ai-base-url-input');

        config.provider = providerSelect ? providerSelect.value : config.provider;
        config.apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        config.model = modelInput ? modelInput.value.trim() : config.model;
        config.baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';

        saveConfig();
        document.getElementById('ai-settings-modal')?.classList.remove('active');
    }

    function updateProviderFields() {
        const provider = document.getElementById('ai-provider-select')?.value || 'gemini';
        const modelInput = document.getElementById('ai-model-input');
        const baseUrlGroup = document.getElementById('ai-base-url-group');

        if (modelInput && !modelInput.value) {
            modelInput.value = PROVIDERS[provider]?.defaultModel || '';
        }

        if (baseUrlGroup) {
            baseUrlGroup.style.display = (provider === 'custom' || provider === 'openrouter') ? 'block' : 'none';
        }
    }

    // Markdown Formatter (simple & safe)
    function formatMarkdown(text) {
        if (!text) return '';
        let escaped = escapeHtml(text);
        
        // Code blocks
        escaped = escaped.replace(/```([a-z]*)\n([\s\S]*?)```/gi, '<pre><code>$2</code></pre>');
        // Inline code
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Newlines
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    return {
        init,
        sendMessage,
        fixError,
        clearChat,
        togglePanel,
        openSettings,
        saveSettingsFromModal,
        updateProviderFields,
        getConfig: () => config
    };
})();
