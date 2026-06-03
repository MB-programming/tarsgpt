<?php
require_once '../config.php';
header('Access-Control-Allow-Origin: *');

// Returns a random short TARS filler phrase as audio (mp3).
// Falls back to a JSON flag if no TTS key.
if (empty(OPENAI_API_KEY)) {
    header('Content-Type: application/json');
    echo json_encode(['fallback' => true]);
    exit;
}

$fillers = ["Hmm.", "Yeah?", "Go ahead.", "Mm.", "Right.", "Acknowledged."];
$text    = $fillers[array_rand($fillers)];

$payload = json_encode([
    'model' => TTS_MODEL,
    'voice' => TTS_VOICE,
    'input' => $text,
    'speed' => TTS_SPEED,
]);

$ch = curl_init('https://api.openai.com/v1/audio/speech');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
    ],
]);
$audio  = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status !== 200) { http_response_code($status); exit; }
header('Content-Type: audio/mpeg');
echo $audio;
