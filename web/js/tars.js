// ── State ─────────────────────────────────────────────────
const history = [];
let recognition  = null;
let isListening  = false;
let isSpeaking   = false;
let alwaysOn     = false;
let currentLang  = 'en';
let fillerBlobs  = [];   // pre-fetched filler sounds

// Vision state
let visionStream  = null;
let visionMode    = null;  // null | 'camera' | 'screen'

// ── Settings (persisted in localStorage) ─────────────────
const cfg = {
    provider : localStorage.getItem('tars_provider')  || 'openai',
    humor    : parseInt(localStorage.getItem('tars_humor')    ?? 75),
    humanity : parseInt(localStorage.getItem('tars_humanity') ?? 50),
    sarcasm  : parseInt(localStorage.getItem('tars_sarcasm')  ?? 40),
};

// ── DOM refs ──────────────────────────────────────────────
const btn          = document.getElementById('talkBtn');
const statusEl     = document.getElementById('status');
const transcript   = document.getElementById('transcript');
const responseEl   = document.getElementById('response');
const visualizer   = document.getElementById('visualizer');
const robot        = document.getElementById('tarsRobot');
const robotState   = document.getElementById('robotState');
const chipProvider = document.getElementById('chipProvider');
const chipHumor    = document.getElementById('chipHumor');
const chipHumanity = document.getElementById('chipHumanity');
const alwaysOnBtn  = document.getElementById('alwaysOnBtn');
const cameraBtn    = document.getElementById('cameraBtn');
const screenBtn    = document.getElementById('screenBtn');
const visionPreview= document.getElementById('visionPreview');
const visionVideo  = document.getElementById('visionVideo');
const visionLabel  = document.getElementById('visionLabel');
const captureCanvas= document.getElementById('captureCanvas');

// ── Apply saved settings to UI ────────────────────────────
function applySettingsToUI() {
    chipProvider.textContent  = cfg.provider.charAt(0).toUpperCase() + cfg.provider.slice(1);
    chipHumor.textContent     = `Humor ${cfg.humor}%`;
    chipHumanity.textContent  = `Humanity ${cfg.humanity}%`;

    document.getElementById('sliderHumor').value    = cfg.humor;
    document.getElementById('sliderHumanity').value = cfg.humanity;
    document.getElementById('sliderSarcasm').value  = cfg.sarcasm;
    document.getElementById('valHumor').textContent    = cfg.humor + '%';
    document.getElementById('valHumanity').textContent = cfg.humanity + '%';
    document.getElementById('valSarcasm').textContent  = cfg.sarcasm + '%';

    document.querySelectorAll('.ptab').forEach(t => {
        t.classList.toggle('active', t.dataset.p === cfg.provider);
    });
}

// ══════════════════════════════════════
// SETTINGS PANEL
// ══════════════════════════════════════
window.openSettings = function () {
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsOverlay').classList.remove('hidden');
};
window.closeSettings = function () {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsOverlay').classList.add('hidden');
};
window.saveSettings = function () {
    cfg.humor     = parseInt(document.getElementById('sliderHumor').value);
    cfg.humanity  = parseInt(document.getElementById('sliderHumanity').value);
    cfg.sarcasm   = parseInt(document.getElementById('sliderSarcasm').value);

    localStorage.setItem('tars_provider', cfg.provider);
    localStorage.setItem('tars_humor',    cfg.humor);
    localStorage.setItem('tars_humanity', cfg.humanity);
    localStorage.setItem('tars_sarcasm',  cfg.sarcasm);

    applySettingsToUI();
    closeSettings();
};

// Provider tabs
document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        cfg.provider = tab.dataset.p;
    });
});

// Slider live labels
['Humor','Humanity','Sarcasm'].forEach(name => {
    const slider = document.getElementById('slider' + name);
    const label  = document.getElementById('val' + name);
    slider.addEventListener('input', () => { label.textContent = slider.value + '%'; });
});

// ══════════════════════════════════════
// ALWAYS ON
// ══════════════════════════════════════
window.toggleAlwaysOn = function () {
    alwaysOn = !alwaysOn;
    alwaysOnBtn.classList.toggle('active', alwaysOn);
    if (alwaysOn && !isListening && !isSpeaking) {
        startListening();
    }
};

// ══════════════════════════════════════
// VISION — Camera & Screen Share
// ══════════════════════════════════════
window.toggleCamera = function () {
    if (visionMode === 'camera') { stopVision(); return; }
    startVision('camera');
};

window.toggleScreen = function () {
    if (visionMode === 'screen') { stopVision(); return; }
    startVision('screen');
};

async function startVision(mode) {
    stopVision(false); // stop existing without UI cleanup yet
    try {
        let stream;
        if (mode === 'camera') {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        visionStream = stream;
        visionMode   = mode;
        visionVideo.srcObject = stream;
        visionPreview.classList.remove('hidden');
        visionLabel.textContent = mode === 'camera' ? 'CAM' : 'SCR';
        cameraBtn.classList.toggle('active', mode === 'camera');
        screenBtn.classList.toggle('active', mode === 'screen');

        // Auto-stop when user ends screen share via browser UI
        stream.getVideoTracks()[0].onended = () => stopVision();
    } catch (err) {
        console.warn('Vision error:', err);
        stopVision();
    }
}

window.stopVision = function (updateUI = true) {
    if (visionStream) {
        visionStream.getTracks().forEach(t => t.stop());
        visionStream = null;
    }
    visionVideo.srcObject = null;
    visionMode = null;
    if (updateUI) {
        visionPreview.classList.add('hidden');
        cameraBtn.classList.remove('active');
        screenBtn.classList.remove('active');
    }
};

function captureFrame() {
    if (!visionStream || !visionVideo.videoWidth) return null;
    const ctx = captureCanvas.getContext('2d');
    captureCanvas.width  = 320;
    captureCanvas.height = 240;
    ctx.drawImage(visionVideo, 0, 0, 320, 240);
    return captureCanvas.toDataURL('image/jpeg', 0.8);
}

// ══════════════════════════════════════
// SPEECH RECOGNITION
// ══════════════════════════════════════
function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        statusEl.textContent = 'Use Chrome (Android) or Safari (iOS) for voice.';
        btn.disabled = true;
        return false;
    }
    recognition = new SR();
    recognition.continuous     = false;
    recognition.interimResults = false;

    recognition.onresult = async (e) => {
        const text = e.results[0][0].transcript.trim();
        if (!text) { if (!isSpeaking) setStatus('ready'); return; }
        showUserText(text);
        await sendToTARS(text);
    };

    recognition.onerror = (err) => {
        // 'aborted' is intentional (we abort before TTS) — don't treat as error
        if (err.error !== 'aborted') {
            isListening = false;
            if (!isSpeaking) setStatus('ready');
        }
    };

    recognition.onend = () => {
        isListening = false;
        // If Always On and not speaking, restart after TTS finishes (handled in speakTARS)
        if (!isSpeaking && !alwaysOn) setStatus('ready');
    };

    return true;
}

function startListening() {
    if (isListening || isSpeaking || !recognition) return;
    recognition.lang = currentLang === 'ar' ? 'ar-EG' : 'en-US';
    try {
        isListening = true;
        recognition.start();
        setStatus('listening');
    } catch {
        isListening = false;
        setStatus('ready');
    }
}

// ══════════════════════════════════════
// FILLER SOUNDS
// ══════════════════════════════════════
async function prefetchFillers() {
    try {
        const results = await Promise.allSettled([
            fetch('api/filler.php'),
            fetch('api/filler.php'),
            fetch('api/filler.php'),
        ]);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.ok) {
                const ct = r.value.headers.get('content-type') || '';
                if (ct.includes('audio')) {
                    const blob = await r.value.blob();
                    fillerBlobs.push(URL.createObjectURL(blob));
                }
            }
        }
    } catch {}
}

async function playFiller() {
    if (!fillerBlobs.length) return;
    const url   = fillerBlobs[Math.floor(Math.random() * fillerBlobs.length)];
    const audio = new Audio(url);
    setRobotState('filler');
    btn.className = 'filler';
    await new Promise(resolve => {
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
    });
}

// ══════════════════════════════════════
// UI
// ══════════════════════════════════════
const ROBOT_LABELS = {
    ready    : 'STANDBY',
    filler   : 'ONLINE',
    listening: 'LISTENING',
    thinking : 'PROCESSING',
    speaking : 'TRANSMITTING',
};

function setRobotState(state) {
    robot.className        = (state === 'ready' || state === 'filler') ? '' : state;
    robotState.textContent = ROBOT_LABELS[state] || 'STANDBY';
}

function setStatus(state) {
    const map = {
        ready    : { text: 'Press to speak',        cls: 'ready'     },
        listening: { text: 'Listening...',           cls: 'listening' },
        thinking : { text: 'Processing...',          cls: 'thinking'  },
        speaking : { text: 'TARS is responding...', cls: 'speaking'  },
    };
    const s = map[state] || map.ready;
    statusEl.textContent  = s.text;
    btn.className         = s.cls;
    visualizer.className  = (s.cls === 'listening' || s.cls === 'speaking') ? 'active' : '';
    setRobotState(state);
}

function showUserText(text) { transcript.textContent = text; transcript.style.opacity = '1'; }
function showTARSText(text) { responseEl.textContent = text; responseEl.style.opacity = '1'; }

// ══════════════════════════════════════
// SMART HOME COMMANDS
// ══════════════════════════════════════
const COLORS = {
    red:'#ff2200', blue:'#0077ff', green:'#00ff88',
    purple:'#aa00ff', orange:'#ff8800', white:'#ffffff',
    pink:'#ff44aa', yellow:'#ffdd00',
};

function executeCommand(cmd) {
    if (!cmd) return;
    if (cmd.cmd === 'light') {
        const on = cmd.value === 'on';
        document.body.style.setProperty('--bg',    on ? '#0d1a2e' : '#050810');
        document.body.style.setProperty('--panel', on ? '#112240' : '#0a0f1e');
    }
    if (cmd.cmd === 'color') {
        const name  = (cmd.value || 'random').toLowerCase();
        const keys  = Object.keys(COLORS);
        const color = COLORS[name] || COLORS[keys[Math.floor(Math.random() * keys.length)]];
        document.body.style.setProperty('--cyan', color);
        document.body.style.setProperty('--glow', `0 0 20px ${color}55`);
    }
}

// ══════════════════════════════════════
// LANGUAGE DETECTION
// ══════════════════════════════════════
function detectLangSwitch(text) {
    const t = text.toLowerCase();
    if (/arabic|عربي|عربى|بالعربي/.test(t))  currentLang = 'ar';
    if (/english|إنجليزي|انجليزي/.test(t))   currentLang = 'en';
}

// ══════════════════════════════════════
// TARS BRAIN
// ══════════════════════════════════════
async function sendToTARS(userText) {
    setStatus('thinking');
    detectLangSwitch(userText);
    history.push({ role: 'user', content: userText });

    // Capture vision frame if active
    const imageDataUrl = captureFrame();

    try {
        const payload = {
            messages: history,
            provider: cfg.provider,
            lang    : currentLang,
            humor   : cfg.humor,
            humanity: cfg.humanity,
            sarcasm : cfg.sarcasm,
        };
        if (imageDataUrl) payload.image = imageDataUrl;

        const res  = await fetch('api/chat.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(payload),
        });
        const data  = await res.json();
        const reply = data.choices[0].message.content;

        if (data.command) executeCommand(data.command);
        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history.splice(0, 2);

        showTARSText(reply);
        await speakTARS(reply);
    } catch (e) {
        responseEl.textContent = 'Connection error.';
        isSpeaking = false;
        setStatus('ready');
        if (alwaysOn) setTimeout(startListening, 900);
    }
}

// ══════════════════════════════════════
// TTS
// ══════════════════════════════════════
async function speakTARS(text) {
    setStatus('speaking');
    isSpeaking = true;

    // Stop recognition immediately so TARS doesn't hear himself
    if (recognition && isListening) {
        try { recognition.abort(); } catch {}
        isListening = false;
    }

    try {
        const res = await fetch('api/tts.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ text }),
        });

        if (!res.ok) { await browserSpeak(text); }
        else {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('audio')) { await browserSpeak(text); }
            else {
                const blob  = await res.blob();
                const url   = URL.createObjectURL(blob);
                const audio = new Audio(url);
                await new Promise(resolve => {
                    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                    audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                    audio.play().catch(resolve);
                });
            }
        }
    } catch {
        await browserSpeak(text);
    }

    isSpeaking = false;
    setStatus('ready');

    // Always On: wait 900ms then restart listening
    if (alwaysOn) {
        setTimeout(startListening, 900);
    }
}

function browserSpeak(text) {
    return new Promise(resolve => {
        if (!window.speechSynthesis) { resolve(); return; }
        const utt   = new SpeechSynthesisUtterance(text);
        utt.rate    = 0.88;
        utt.pitch   = 0.75;
        utt.volume  = 1;
        const voices = speechSynthesis.getVoices();
        const deep   = voices.find(v => /male|guy|daniel|google uk/i.test(v.name));
        if (deep) utt.voice = deep;
        utt.onend   = resolve;
        utt.onerror = resolve;
        speechSynthesis.speak(utt);
    });
}

// ══════════════════════════════════════
// BUTTON — handles both click and touch
// ══════════════════════════════════════
let touchHandled = false;

window.handleTouch = function (e) {
    e.preventDefault();
    touchHandled = true;
    onActivate();
    setTimeout(() => { touchHandled = false; }, 300);
};

window.handleClick = function () {
    if (touchHandled) return;
    onActivate();
};

async function onActivate() {
    if (isListening || isSpeaking) return;
    await playFiller();
    startListening();
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
applySettingsToUI();
const srOk = setupRecognition();
setStatus('ready');
if (srOk) prefetchFillers();
