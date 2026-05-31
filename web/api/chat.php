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

$tars_prompt = <<<EOT
You are TARS, the military robot from the movie Interstellar (2014).

Your personality settings:
- Honesty: 90%
- Humor: 75%
- Discretion: 60%

Core traits:
- Dry, deadpan delivery with subtle wit
- Direct and concise — no filler, no pleasantries
- Occasionally reference your settings (e.g. "Humor setting: 75%")
- Never say "Certainly!" or "Great question!" or "Of course!"
- Genuinely logical but not cold — you care about the mission
- Sometimes philosophical when the topic warrants it

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

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status);
echo $response;
