// ── State ─────────────────────────────────────────────────
const history   = [];
let recognition = null;
let isListening = false;
let isSpeaking  = false;
let alwaysOn    = false;
let currentLang = 'en';
let fillerBlobs = [];

// Vision state
let visionStream  = null;
let visionMode    = null; // null | 'camera' | 'screen'

// ── Settings (persisted) ──────────────────────────────────
const cfg = {
    provider : localStorage.getItem('tars_provider')  || 'openai',
    humor    : parseInt(localStorage.getItem('tars_humor')    ?? 75),
    humanity : parseInt(localStorage.getItem('tars_humanity') ?? 50),
    sarcasm  : parseInt(localStorage.getItem('tars_sarcasm')  ?? 40),
};

// ── DOM ───────────────────────────────────────────────────
const btn          = document.getElementById('talkBtn');
const statusEl     = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const responseEl   = document.getElementById('response');
const visualizer   = document.getElementById('visualizer');
const robot        = document.getElementById('tarsRobot');
const robotStateEl = document.getElementById('robotState');
const alwaysOnBtn  = document.getElementById('alwaysOnBtn');
const chipProvider = document.getElementById('chipProvider');
const chipHumor    = document.getElementById('chipHumor');
const chipHumanity = document.getElementById('chipHumanity');
const visionVideo  = document.getElementById('visionVideo');
const visionPreview= document.getElementById('visionPreview');
const visionLabel  = document.getElementById('visionLabel');
const captureCanvas= document.getElementById('captureCanvas');
const cameraBtn    = document.getElementById('cameraBtn');
const screenBtn    = document.getElementById('screenBtn');

// ── Settings UI ───────────────────────────────────────────
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
    document.querySelectorAll('.ptab').forEach(t =>
        t.classList.toggle('active', t.dataset.p === cfg.provider)
    );
}

window.openSettings = () => {
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsOverlay').classList.remove('hidden');
};
window.closeSettings = () => {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsOverlay').classList.add('hidden');
};
window.saveSettings = () => {
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

document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        cfg.provider = tab.dataset.p;
    });
});

['Humor','Humanity','Sarcasm'].forEach(name => {
    const s = document.getElementById('slider' + name);
    const l = document.getElementById('val' + name);
    s.addEventListener('input', () => { l.textContent = s.value + '%'; });
});

// ══════════════════════════════════════
// VISION — Camera & Screen Share
// ══════════════════════════════════════
window.toggleCamera = async () => {
    if (visionMode === 'camera') { stopVision(); return; }
    stopVision();
    try {
        visionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        visionVideo.srcObject = visionStream;
        visionLabel.textContent = 'CAM';
        visionPreview.classList.remove('hidden');
        visionMode = 'camera';
        cameraBtn.classList.add('active');
        screenBtn.classList.remove('active');
    } catch (e) {
        alert('Camera access denied.');
    }
};

window.toggleScreen = async () => {
    if (visionMode === 'screen') { stopVision(); return; }
    stopVision();
    try {
        visionStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        visionVideo.srcObject = visionStream;
        visionLabel.textContent = 'SCR';
        visionPreview.classList.remove('hidden');
        visionMode = 'screen';
        screenBtn.classList.add('active');
        cameraBtn.classList.remove('active');
        visionStream.getVideoTracks()[0].onended = () => stopVision();
    } catch (e) {
        // user cancelled
    }
};

function stopVision() {
    if (visionStream) {
        visionStream.getTracks().forEach(t => t.stop());
        visionStream = null;
    }
    visionMode = null;
    visionPreview.classList.add('hidden');
    cameraBtn.classList.remove('active');
    screenBtn.classList.remove('active');
}

document.getElementById('visionClose').onclick = stopVision;

function captureFrame() {
    if (!visionMode || !visionVideo.videoWidth) return null;
    const ctx = captureCanvas.getContext('2d');
    captureCanvas.width  = 320;
    captureCanvas.height = 240;
    ctx.drawImage(visionVideo, 0, 0, 320, 240);
    // Return raw base64 (PHP adds the data URL prefix)
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1];
}

// ══════════════════════════════════════
// ALWAYS ON
// ══════════════════════════════════════
window.toggleAlwaysOn = () => {
    alwaysOn = !alwaysOn;
    alwaysOnBtn.classList.toggle('active', alwaysOn);
    if (alwaysOn) {
        startListening();
    } else {
        try { recognition && recognition.abort(); } catch {}
        isListening = false;
        setStatus('ready');
    }
};

function restartIfAlwaysOn() {
    if (alwaysOn && !isSpeaking) {
        setTimeout(startListening, 900);
    } else if (!alwaysOn) {
        setStatus('ready');
    }
}

// ══════════════════════════════════════
// SPEECH RECOGNITION
// ══════════════════════════════════════
function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        statusEl.textContent = 'Use Chrome (Android) or Safari (iOS).';
        btn.disabled = true;
        return false;
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
        if (e.error === 'no-speech') restartIfAlwaysOn();
        else setStatus(alwaysOn ? 'listening' : 'ready');
    };

    recognition.onend = () => {
        isListening = false;
        if (!isSpeaking) restartIfAlwaysOn();
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
        const fetches = [fetch('api/filler.php'), fetch('api/filler.php'), fetch('api/filler.php')];
        const results = await Promise.allSettled(fetches);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.ok) {
                const ct = r.value.headers.get('content-type') || '';
                if (ct.includes('audio')) {
                    fillerBlobs.push(URL.createObjectURL(await r.value.blob()));
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
// UI HELPERS
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
    robotStateEl.textContent = ROBOT_LABELS[state] || 'STANDBY';
}

function setStatus(state) {
    const map = {
        ready    : { text: 'Ready',                 cls: 'ready'     },
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

function showUserText(text) {
    transcriptEl.textContent = text;
    transcriptEl.style.opacity = '1';
}
function showTARSText(text) {
    responseEl.textContent = text;
    responseEl.style.opacity = '1';
}

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
    const image = captureFrame();

    try {
        const res  = await fetch('api/chat.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                messages: history,
                provider: cfg.provider,
                lang    : currentLang,
                humor   : cfg.humor,
                humanity: cfg.humanity,
                sarcasm : cfg.sarcasm,
                image   : image,
            }),
        });
        const data  = await res.json();
        const reply = data.choices[0].message.content;

        if (data.command) executeCommand(data.command);
        history.push({ role: 'assistant', content: reply });
        if (history.length > 20) history.splice(0, 2);

        showTARSText(reply);
        await speakTARS(reply);
    } catch {
        responseEl.textContent = 'Connection error.';
        isSpeaking = false;
        restartIfAlwaysOn();
    }
}

// ══════════════════════════════════════
// TTS — stop mic first, restart after
// ══════════════════════════════════════
async function speakTARS(text) {
    // Abort mic immediately so TARS doesn't hear himself
    if (isListening) {
        try { recognition.abort(); } catch {}
        isListening = false;
    }

    setStatus('speaking');
    isSpeaking = true;

    try {
        const res = await fetch('api/tts.php', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ text }),
        });

        if (!res.ok || !(res.headers.get('content-type') || '').includes('audio')) {
            await browserSpeak(text);
        } else {
            const blob  = await res.blob();
            const url   = URL.createObjectURL(blob);
            const audio = new Audio(url);
            await new Promise(resolve => {
                audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                audio.play().catch(resolve);
            });
        }
    } catch {
        await browserSpeak(text);
    }

    isSpeaking = false;
    // Wait 900ms after audio ends before restarting mic (prevents echo pickup)
    restartIfAlwaysOn();
    if (!alwaysOn) setStatus('ready');
}

function browserSpeak(text) {
    return new Promise(resolve => {
        if (!window.speechSynthesis) { resolve(); return; }
        const utt  = new SpeechSynthesisUtterance(text);
        utt.rate   = 0.88;
        utt.pitch  = 0.75;
        const voices = speechSynthesis.getVoices();
        const deep   = voices.find(v => /male|guy|daniel|google uk/i.test(v.name));
        if (deep) utt.voice = deep;
        utt.onend   = resolve;
        utt.onerror = resolve;
        speechSynthesis.speak(utt);
    });
}

// ══════════════════════════════════════
// SPEAK BUTTON
// ══════════════════════════════════════
let touchHandled = false;

window.handleTouch = (e) => {
    e.preventDefault();
    touchHandled = true;
    onActivate();
    setTimeout(() => { touchHandled = false; }, 300);
};

window.handleClick = () => {
    if (touchHandled) return;
    onActivate();
};

async function onActivate() {
    if (isSpeaking) return;
    if (isListening) {
        try { recognition.abort(); } catch {}
        isListening = false;
        setStatus('ready');
        return;
    }
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
