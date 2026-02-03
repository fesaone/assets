/* --- CONFIGURATION & STATE --- */
const WP_API_ENDPOINT = context.env.API_KEY;
const SAFETY_MODEL = "meta-llama/llama-guard-4-12b"; 
const CHAT_MODEL = "llama-3.3-70b-versatile"; 

const safetyCache = new Map();
const MAX_HISTORY_LENGTH = 10;

// --- Knowledge Map
const knowledgeMap = [
    {
        keys: ["siapa", "pembuat", "creator", "author", "kamu", "identitas", "fauzi", "pengembang", "founder", "dev", "owner", "kapan", "dibuat", "tahun", "tanggal", "rilis", "lahir", "sejarah", "dari", "mana", "asal", "lokasi", "domisili", "tentang", "fesabot", "fesaone"],
        response: "**Fesaone AI** dikembangkan oleh **Fauzi Eka Suryana** di Bandung, Indonesia (Januari 2026).\n\nDia adalah Developer, UI/UX Designer, dan Progamer yang memulai karir sejak 2019. Saat ini aktif sebagai Tech Lead untuk teknologi dan AI di Indonesia. Dia pemilik sekaligus pendiri utama platform https://fesa.one"
    },
    {
        keys: ["kontak", "email", "hubungi", "call", "tanya", "admin", "telepon", "nomor", "hp", "no", "whatsapp", "wa", "instagram", "ig", "sosmed", "social", "media", "twitter", "linkedin"],
        response: "Anda dapat menghubungi Fauzi Eka Suryana melalui:\n• Email: dev@fesa.one (mailto:dev@fesa.one)\n• Telepon: +62-8999-9400-44\n• Instagram: @fesaonedev (https://instagram.com/fesaonedev)"
    },
    {
        keys: ["layanan", "produk", "jasa", "fitur", "website", "situs", "url", "link", "store", "toko", "belanja", "beli", "harga", "tema", "theme", "plugin", "sistem", "system", "sandbox", "playground", "demo"],
        response: "Layanan Ekosistem Fesaone:\n• **AI Chat:** fesa.one (https://fesa.one/)\n• **Playground:** SANDBOX (https://fesa.one/sandbox/)\n• **Store (Themes & System):** Fesa Store (https://fesa.one/store/)"
    },
    {
        keys: ["terms", "tos", "syarat", "ketentuan", "rules", "privacy", "privasi", "kebijakan", "data", "aman", "riset", "research", "agi", "penelitian", "help", "bantuan", "panduan", "pakai"],
        response: "Info Legal & Riset:\n• Riset AGI: Research Page (https://fesa.one/research/)\n• Privacy & Terms: Lihat Dokumen (https://fesa.one/terms-of-service)"
    }
];

const SYSTEM_PROMPT = `You are Fesaone AI (fesa.one), created by Fauzi Eka Suryana (Bandung, ID). He is a Dev/Designer & Tech Lead at Indonesian. Be helpful, concise, and polite in Indonesian.`;
let chatHistory = []; 

/* --- DOM ELEMENTS --- */
const chatContainer = document.getElementById('chat-container');
const messagesWrapper = document.getElementById('messages-wrapper');
const welcomeScreen = document.getElementById('welcome-screen');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const voiceBtn = document.getElementById('voice-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const placeholder = document.getElementById('placeholder');

/* --- LOGIC: UTILITIES & MEMORY --- */

function tokenize(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2);
}

function checkLocalMemory(text) {
    const inputTokens = tokenize(text);
    if (inputTokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;
    const THRESHOLD = 0.5;

    knowledgeMap.forEach(item => {
        const keySet = new Set(item.keys.map(k => k.toLowerCase()));
        let matchCount = 0;

        inputTokens.forEach(token => {
            if (keySet.has(token)) matchCount++;
        });

        const score = matchCount / inputTokens.length;

        if (score > THRESHOLD && score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    });

    return bestMatch ? bestMatch.response : null;
}

function formatText(text) {
    if (!text) return "";

    let clean = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>');

    clean = clean.replace(/\n/g, '<br>');

    clean = clean.replace(
        /((https?:\/\/)|(mailto:))[^\s<]+/g, 
        function(url) {
            return `<a href="${url}" target="_blank" class="text-blue-400 underline">${url}</a>`;
        }
    );

    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
        const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
        clean = clean.replace(regex, '');
        // Hapus tag pembuka saja jika tidak berpasangan
        const openRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
        clean = clean.replace(openRegex, '');
    });

    clean = clean.replace(/&amp;/g, "&")
                 .replace(/&lt;/g, "<")
                 .replace(/&gt;/g, ">");

    return clean;
}

/* --- LOGIC: SAFETY & API --- */

function normalizePrompt(text) {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function checkPromptSafety(rawPrompt) {
    const normalized = normalizePrompt(rawPrompt);
    if (safetyCache.has(normalized)) return safetyCache.get(normalized);

    const payload = {
        model: SAFETY_MODEL,
        messages: [{ role: "user", content: rawPrompt }],
        temperature: 0,
        max_tokens: 32
    };

    try {
        const response = await fetch(WP_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Safety API Error");
        
        const data = await response.json();
        // Data structure dari proxy akan sama dengan response Groq asli
        const resultText = data.choices[0].message.content.toLowerCase();
        
        const isSafe = resultText.includes("safe") && !resultText.includes("unsafe");
        safetyCache.set(normalized, isSafe);
        return isSafe;

    } catch (error) {
        console.error("[System] Safety Check Exception:", error);
        return true; // Fail-safe
    }
}

async function getGroqChatResponse(userMessage) {
    try {
        const recentHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);

        const messagesToSend = [
            { role: "system", content: SYSTEM_PROMPT },
            ...recentHistory, 
            { role: "user", content: userMessage }
        ];

        const payload = {
            model: CHAT_MODEL,
            messages: messagesToSend,
            temperature: 0.7,
            max_tokens: 1024
        };

        const response = await fetch(WP_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error || data.code) {
            throw new Error(data.message || data.error?.message || "Terjadi kesalahan.");
        }

        const aiReply = data.choices[0].message.content;

        chatHistory.push({ role: "user", content: userMessage });
        chatHistory.push({ role: "assistant", content: aiReply });
        
        return aiReply;

    } catch (error) {
        console.error("Chat Error:", error);
        return "Maaf, terjadi gangguan koneksi pada server. Silakan coba lagi.";
    }
}

/* --- UI FUNCTIONS --- */

let isTyping = false;

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    });
}

function createMessageBubble(text, isUser) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`;
    
    const bubble = document.createElement('div');
    bubble.className = `max-w-[90%] md:max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed break-words shadow-sm border backdrop-blur-sm ${
        isUser 
        ? 'bg-neutral-800 text-neutral-300 border-neutral-700 rounded-br-md' 
        : 'bg-neutral-900/90 text-neutral-200 border-neutral-800 rounded-bl-md'
    }`;

    if (!isUser) {
        const header = document.createElement('div');
        header.className = 'flex items-center gap-2 mb-2 opacity-70';
        header.innerHTML = `
            <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center overflow-hidden border border-neutral-800">
                <img src="https://fesa.one/assets/logo/FESA-ONE.png" alt="FESA" class="w-full h-full object-cover">
            </div>
            <span class="text-[10px] font-bold tracking-wider text-white">FESA AI</span>
        `;
        bubble.appendChild(header);
    }

    const textSpan = document.createElement('div');
    textSpan.className = "ai-text-content";
    
    if (isUser) {
        textSpan.textContent = text;
    } else {
        textSpan.innerHTML = formatText(text);
    }
    
    bubble.appendChild(textSpan);
    wrapper.appendChild(bubble);
    return { wrapper, textSpan };
}

async function handleSubmission(event) {
    if (event) event.preventDefault();
    const text = userInput.value.trim();
    if (!text || isTyping) return;

    if (!welcomeScreen.classList.contains('hidden')) {
        welcomeScreen.classList.add('hidden');
        messagesWrapper.classList.remove('hidden');
    }

    const { wrapper: userWrapper } = createMessageBubble(text, true);
    messagesWrapper.appendChild(userWrapper);
    
    userInput.value = '';
    placeholder.style.display = 'block';
    scrollToBottom();

    isTyping = true;
    loadingIndicator.classList.remove('hidden');
    messagesWrapper.appendChild(loadingIndicator);
    scrollToBottom();

    let responseText = "";
    let isLocalMemory = false;

    const localAnswer = checkLocalMemory(text);
    
    if (localAnswer) {
        console.log("[System] Response from Local Memory");
        isLocalMemory = true;
        await new Promise(r => setTimeout(r, 600)); 
        responseText = localAnswer;

    } else {
        const isSafe = await checkPromptSafety(text);

        if (!isSafe) {
            console.log("[System] Blocked by Safety Filter");
            responseText = "Maaf, permintaan Anda tidak dapat diproses karena melanggar kebijakan keamanan sistem.";
        } else {
            responseText = await getGroqChatResponse(text);
        }
    }

    loadingIndicator.classList.add('hidden');

    const { wrapper: aiWrapper, textSpan: aiTextSpan } = createMessageBubble("", false);
    messagesWrapper.appendChild(aiWrapper);

    aiTextSpan.innerHTML = formatText(responseText);
    
    isTyping = false;
    scrollToBottom();
    
    if(!('ontouchstart' in window)) {
        userInput.focus();
    }
}

chatForm.addEventListener('submit', handleSubmission);

/* --- SHORTCUT BUTTONS --- */

const btnStudy = document.getElementById('btn-study');
const btnCode = document.getElementById('btn-code');
const btnResearch = document.getElementById('btn-research');

function triggerShortcut(text) {
    if(isTyping) return;
    userInput.value = text;
    placeholder.style.display = 'none';
    handleSubmission(null);
}

if(btnStudy) btnStudy.addEventListener('click', () => triggerShortcut("Bantu saya Studi dan belajar."));
if(btnCode) btnCode.addEventListener('click', () => triggerShortcut("Berpikir lebih dalam."));
if(btnResearch) btnResearch.addEventListener('click', () => triggerShortcut("Bantu saya melakukan penelitian mendalam."));

/* --- UTILS: INPUT & VOICE --- */

userInput.addEventListener('focus', () => placeholder.style.display = 'none');
userInput.addEventListener('blur', () => { if (!userInput.value) placeholder.style.display = 'block'; });
userInput.addEventListener('input', () => {
    placeholder.style.display = userInput.value ? 'none' : 'block';
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.continuous = false;
    
    voiceBtn.addEventListener('click', () => {
        try {
            voiceBtn.classList.add('text-red-500', 'animate-pulse');
            recognition.start();
        } catch (e) {
            console.warn("Voice recognition already started");
        }
    });
    
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        userInput.value = transcript;
        placeholder.style.display = 'none';
    };
    
    recognition.onerror = (e) => {
        console.error("Voice Error", e);
        voiceBtn.classList.remove('text-red-500', 'animate-pulse');
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('text-red-500', 'animate-pulse');
    };
} else {
    if(voiceBtn) voiceBtn.style.display = 'none';
}

