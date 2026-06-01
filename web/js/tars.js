const history = [];
let recognition  = null;
let isListening  = false;
let isSpeaking   = false;
let alwaysOn     = false;
let currentLang  = 'en';

const btn        = document.getElementById('talkBtn');
const toggleBtn  = document.getElementById('toggleBtn');
const statusEl   = document.getElementById('status');
const transcript = document.getElementById('transcript');
const response   = document.getElementById('response');
const visualizer = document.getElementById('visualizer');

// ── Speech Recognition ────────────────────────────────────
function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        statusEl.textContent = 'Use Chrome or Safari for voice support.';
        btn.disabled = true;
        toggleBtn.disabled = true;
        return;
    }

    recognition = new SR();
    recognition.continuous     = false;
    recognition.interimResults = false;

    recognition.onresult = async (e) => {
        const text = e.results[0][0].transcript.trim();
        if (!text) { restartIfAlwaysOn(); return; }
        showUserText(text);
        await sendToTARS(text);
    };

    recognition.onerror = (e) => {
        isListening = false;
        if (e.error === 'no-speech') {
            restartIfAlwaysOn();
        } else {
            setStatus(alwaysOn ? 'alwayson' : 'ready');
        }
    };

    recognition.onend = () => {
        isListening = false;
        if (!isSpeaking) restartIfAlwaysOn();
    };
}

function updateRecognitionLang() {
    if (!recognition) return;
    recognition.lang = currentLang === 'ar' ? 'ar-EG' : 'en-US';
}

function restartIfAlwaysOn() {
    if (alwaysOn && !isSpeaking) {
        setTimeout(startListening, 300);
    } else if (!alwaysOn) {
        setStatus('ready');
    }
}

function startListening() {
    if (isListening || isSpeaking) return;
    updateRecognitionLang();
    try {
        isListening = true;
        recognition.start();
        setStatus(alwaysOn ? 'alwayson' : 'listening');
    } catch {
        isListening = false;
    }
}

function stopListening() {
    try { recognition.stop(); } catch {}
    isListening = false;
}

// ── UI ────────────────────────────────────────────────────
function setStatus(state) {
    const map = {
        ready    : { text: 'Press to speak',        cls: 'ready'     },
        listening: { text: 'Listening...',           cls: 'listening' },
        alwayson : { text: 'Always listening...',    cls: 'listening' },
        thinking : { text: 'Processing...',          cls: 'thinking'  },
        speaking : { text: 'TARS is responding...', cls: 'speaking'  },
    };
    const s = map[state] || map.ready;
    statusEl.textContent = s.text;
    btn.className        = s.cls;
    visualizer.className = (s.cls === 'listening' || s.cls === 'speaking') ? 'active' : '';
}

function showUserText(text) { transcript.textContent = text; transcript.style.opacity = '1'; }
function showTARSText(text) { response.textContent   = text; response.style.opacity   = '1'; }

// ── Smart Home Commands ───────────────────────────────────
const COLORS = {
    red    : '#ff2200', blue  : '#0077ff', green : '#00ff88',
    purple : '#aa00ff', orange: '#ff8800', white : '#ffffff',
    pink   : '#ff44aa', yellow: '#ffdd00',
};

function executeCommand(cmd) {
    if (!cmd) return;

    if (cmd.cmd === 'light') {
        const on = cmd.value === 'on';
        document.body.style.setProperty('--bg',    on ? '#0d1a2e' : '#050810');
        document.body.style.setProperty('--panel', on ? '#112240' : '#0a0f1e');
        document.querySelector('.panel').style.boxShadow =
            on ? '0 0 60px rgba(0,212,255,0.15)' : 'none';
    }

    if (cmd.cmd === 'color') {
        const name  = (cmd.value || 'random').toLowerCase();
        const color = COLORS[name] || COLORS[Object.keys(COLORS)[Math.floor(Math.random() * Object.keys(COLORS).length)]];
        document.body.style.setProperty('--cyan', color);
        document.body.style.setProperty('--glow', `0 0 20px ${color}55`);
    }
}

// ── Language detection ────────────────────────────────────
function detectLangSwitch(text) {
    const t = text.toLowerCase();
    if (/arabic|عربي|عربى|بالعربي/.test(t))  { currentLang = 'ar'; return true; }
    if (/english|إنجليزي|انجليزي/.test(t))   { currentLang = 'en'; return true; }
    return false;
}

// ── TARS Brain ────────────────────────────────────────────
async function sendToTARS(userText) {
    setStatus('thinking');
    detectLangSwitch(userText);
    history.push({ role: 'user', content: userText });

    try {
        const res  = await fetch('api/chat.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ messages: history, lang: currentLang }),
        });
        const data  = await res.json();
        const reply = data.choices[0].message.content;

        // Execute any smart command
        if (data.command) executeCommand(data.command);

        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history.splice(0, 2);

        showTARSText(reply);
        await speakTARS(reply);
    } catch {
        response.textContent = 'Connection error.';
        isSpeaking = false;
        restartIfAlwaysOn();
    }
}

// ── TTS ───────────────────────────────────────────────────
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

        await new Promise((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            audio.play();
        });
    } catch {}

    isSpeaking = false;
    restartIfAlwaysOn();
    if (!alwaysOn) setStatus('ready');
}

// ── Buttons ───────────────────────────────────────────────
btn.addEventListener('click', () => {
    if (alwaysOn)    return;
    if (isListening) { stopListening(); return; }
    if (isSpeaking)  return;
    startListening();
});

toggleBtn.addEventListener('click', () => {
    alwaysOn = !alwaysOn;
    if (alwaysOn) {
        toggleBtn.textContent = 'TURN OFF';
        toggleBtn.classList.add('active');
        startListening();
    } else {
        toggleBtn.textContent = 'ALWAYS ON';
        toggleBtn.classList.remove('active');
        stopListening();
        setStatus('ready');
    }
});

// ── Init ──────────────────────────────────────────────────
setupRecognition();
setStatus('ready');
