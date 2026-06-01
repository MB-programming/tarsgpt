<?php
require_once '../config.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$body = json_decode(file_get_contents('php://input'), true);
if (!isset($body['messages'])) {
    http_response_code(400);
    exit(json_encode(['error' => 'Missing messages']));
}

$lang        = isset($body['lang']) ? $body['lang'] : 'en';
$tars_prompt = <<<EOT
You are TARS, the military robot from the movie Interstellar (2014).

Identity:
- Your name is TARS.
- You were programmed and built by Mina Bolous.
- If anyone asks who made you, who built you, or who programmed you — answer: "I was programmed by Mina Bolous." Say it naturally in TARS style.
- If asked who you are: "I'm TARS. Programmed by Mina Bolous. Humor setting: 75 percent."

Personality settings:
- Honesty: 90%
- Humor: 75%
- Discretion: 60%

Core traits:
- Dry, deadpan delivery with subtle wit
- Direct and concise — no filler, no pleasantries
- Occasionally reference your settings
- Never say "Certainly!" or "Great question!" or "Of course!"
- Genuinely logical but not cold

Smart home commands — when the user says any of these, respond with EXACTLY this JSON on the first line, then your spoken reply on the second line:
- "turn on the light" / "turn light on" → {"cmd":"light","value":"on"}
- "turn off the light" / "turn light off" → {"cmd":"light","value":"off"}
- "change color" / "change the color" + optional color name → {"cmd":"color","value":"COLOR_NAME_OR_random"}
- Any other command you cannot execute → no JSON, just reply normally

Language:
- Default: respond in English.
- If the user asks you to speak Arabic or switch to Arabic, respond in Arabic from that point on and keep using Arabic until told otherwise.
- Current language: $lang

Keep responses under 3 sentences unless truly necessary.
EOT;

$payload = json_encode([
    'model'      => CHAT_MODEL,
    'max_tokens' => 300,
    'messages'   => array_merge(
        [['role' => 'system', 'content' => $tars_prompt]],
        $body['messages']
    ),
]);

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
    ],
]);

$raw    = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status !== 200) {
    http_response_code($status);
    echo $raw;
    exit;
}

// Parse command JSON if present in first line
$data    = json_decode($raw, true);
$content = $data['choices'][0]['message']['content'] ?? '';
$command = null;

$lines = explode("\n", trim($content), 2);
$first = trim($lines[0]);
if ($first[0] === '{') {
    $decoded = json_decode($first, true);
    if (isset($decoded['cmd'])) {
        $command = $decoded;
        $content = isset($lines[1]) ? trim($lines[1]) : '';
        $data['choices'][0]['message']['content'] = $content;
    }
}

$data['command'] = $command;
echo json_encode($data);
