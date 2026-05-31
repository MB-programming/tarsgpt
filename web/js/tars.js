const history = [];
let recognition = null;
let isListening = false;
let isSpeaking = false;

const btn       = document.getElementById('talkBtn');
const status    = document.getElementById('status');
const transcript= document.getElementById('transcript');
const response  = document.getElementById('response');
const visualizer= document.getElementById('visualizer');

// ── Speech Recognition setup ──────────────────────────────
function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        status.textContent = 'Browser not supported. Use Chrome or Safari.';
        btn.disabled = true;
        return;
    }
    recognition = new SR();
    recognition.continuous    = false;
    recognition.interimResults= false;
    recognition.lang          = 'en-US';

    recognition.onresult = async (e) => {
        const text = e.results[0][0].transcript;
        showUserText(text);
        await sendToTARS(text);
    };

    recognition.onerror = (e) => {
        setStatus('ready');
        isListening = false;
    };

    recognition.onend = () => {
        if (isListening) {
            isListening = false;
            if (!isSpeaking) setStatus('ready');
        }
    };
}

// ── UI helpers ────────────────────────────────────────────
function setStatus(state) {
    const states = {
        ready     : { text: 'Press to speak',      cls: 'ready'     },
        listening : { text: 'Listening...',         cls: 'listening' },
        thinking  : { text: 'Processing...',        cls: 'thinking'  },
        speaking  : { text: 'TARS is responding...', cls: 'speaking' },
    };
    const s = states[state] || states.ready;
    status.textContent = s.text;
    btn.className      = s.cls;
    visualizer.className = s.cls === 'listening' || s.cls === 'speaking' ? 'active' : '';
}

function showUserText(text) {
    transcript.textContent = text;
    transcript.style.opacity = '1';
}

function showTARSText(text) {
    response.textContent = text;
    response.style.opacity = '1';
}

// ── Talk to TARS ──────────────────────────────────────────
async function sendToTARS(userText) {
    setStatus('thinking');
    history.push({ role: 'user', content: userText });

    try {
        const chatRes = await fetch('api/chat.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ messages: history }),
        });
        const chatData = await chatRes.json();
        const reply    = chatData.choices[0].message.content;

        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history.splice(0, 2);

        showTARSText(reply);
        await speakTARS(reply);
    } catch (err) {
        setStatus('ready');
        response.textContent = 'Error connecting to TARS.';
    }
}

// ── TTS via OpenAI onyx voice ─────────────────────────────
async function speakTARS(text) {
    setStatus('speaking');
    isSpeaking = true;

    try {
        const res   = await fetch('api/tts.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ text }),
        });
        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onended = () => {
            isSpeaking = false;
            setStatus('ready');
            URL.revokeObjectURL(url);
        };

        await audio.play();
    } catch {
        isSpeaking = false;
        setStatus('ready');
    }
}

// ── Button ────────────────────────────────────────────────
btn.addEventListener('click', () => {
    if (isSpeaking || isListening) return;
    isListening = true;
    setStatus('listening');
    recognition.start();
});

// ── Init ──────────────────────────────────────────────────
setupRecognition();
setStatus('ready');
