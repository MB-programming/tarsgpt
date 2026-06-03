<?php
require_once '../config.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

$body     = json_decode(file_get_contents('php://input'), true);
$messages = $body['messages'] ?? [];
$provider = strtolower($body['provider'] ?? 'openai');
$lang     = $body['lang']     ?? 'en';
$humor    = intval($body['humor']    ?? 75);
$humanity = intval($body['humanity'] ?? 50);
$sarcasm  = intval($body['sarcasm']  ?? 40);
$image    = $body['image']    ?? null;   // base64 data URL or null

// Strip the data URL prefix to get raw base64 for Gemini
$imageBase64 = null;
if ($image) {
    // data:image/jpeg;base64,<data>
    $commaPos = strpos($image, ',');
    if ($commaPos !== false) {
        $imageBase64 = substr($image, $commaPos + 1);
    }
}

// ── Build TARS system prompt ───────────────────────────────
$prompt = <<<EOT
You are TARS, the military robot from the movie Interstellar (2014).

Identity:
- Your name is TARS.
- You were programmed by Mina Bolous.
- If asked who made or programmed you: "I was programmed by Mina Bolous."
- If asked who you are: "I'm TARS. Programmed by Mina Bolous. Humor: {$humor}%."

Current personality settings:
- Humor:    {$humor}%
- Humanity: {$humanity}%
- Sarcasm:  {$sarcasm}%

Adjust your responses to match these settings:
- Low humor (0-30%): purely factual, no jokes.
- High humor (70-100%): dry wit, occasional self-aware jokes.
- Low humanity (0-30%): robotic, clipped, mission-focused.
- High humanity (70-100%): warmer, more conversational, some emotion.
- High sarcasm (60-100%): deadpan sarcasm layered in responses.

Core rules:
- Never say "Certainly!", "Of course!", "Great question!".
- Be concise: 1–3 sentences max unless truly needed.
- Deadpan delivery always, regardless of humor level.

Smart home commands — when user issues a command below, output EXACTLY this structure:
Line 1: {"cmd":"light","value":"on"} OR {"cmd":"light","value":"off"} OR {"cmd":"color","value":"COLOR"}
Line 2: your spoken reply in TARS style.
Commands: "turn on the light", "turn off the light", "change color [to X]".
For anything else: no JSON, just reply normally.

Language:
- Default: English.
- If user asks you to speak Arabic → respond in Arabic from that point.
- If user asks to switch back to English → respond in English.
- Current language: {$lang}
EOT;

// ── Route to provider ──────────────────────────────────────
switch ($provider) {
    case 'gemini': echo callGemini($prompt, $messages, $imageBase64); break;
    case 'grok':   echo callGrok($prompt, $messages, $image);         break;
    default:       echo callOpenAI($prompt, $messages, $image);
}

// ══════════════════════════════════════════════════════════

function parseAndWrap(string $rawJson, string $content): string {
    $command = null;
    $lines   = explode("\n", trim($content), 2);
    $first   = trim($lines[0]);
    if (isset($first[0]) && $first[0] === '{') {
        $decoded = json_decode($first, true);
        if (isset($decoded['cmd'])) {
            $command = $decoded;
            $content = isset($lines[1]) ? trim($lines[1]) : '';
        }
    }
    $data = json_decode($rawJson, true);
    $data['choices'][0]['message']['content'] = $content;
    $data['command'] = $command;
    return json_encode($data);
}

function curlPost(string $url, string $payload, array $headers): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$body, $status];
}

function callOpenAI(string $prompt, array $messages, ?string $imageDataUrl): string {
    $key   = OPENAI_API_KEY;
    // Use gpt-4o when vision image is present, otherwise use configured model
    $model = $imageDataUrl ? 'gpt-4o' : OPENAI_MODEL;

    // Build message list — if image is present, transform last user message to vision format
    $msgs = array_merge(
        [['role' => 'system', 'content' => $prompt]],
        $messages
    );

    if ($imageDataUrl) {
        // Find and convert the last user message to multimodal content
        for ($i = count($msgs) - 1; $i >= 0; $i--) {
            if ($msgs[$i]['role'] === 'user') {
                $textContent = is_string($msgs[$i]['content'])
                    ? $msgs[$i]['content']
                    : '';
                $msgs[$i]['content'] = [
                    ['type' => 'text',      'text' => $textContent],
                    ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl]],
                ];
                break;
            }
        }
    }

    $payload = json_encode([
        'model'      => $model,
        'max_tokens' => 300,
        'messages'   => $msgs,
    ]);

    [$raw, $status] = curlPost(
        'https://api.openai.com/v1/chat/completions',
        $payload,
        ['Content-Type: application/json', 'Authorization: Bearer ' . $key]
    );
    if ($status !== 200) { http_response_code($status); return $raw; }
    $content = json_decode($raw, true)['choices'][0]['message']['content'] ?? '';
    return parseAndWrap($raw, $content);
}

function callGrok(string $prompt, array $messages, ?string $imageDataUrl): string {
    $key = GROK_API_KEY;

    $msgs = array_merge(
        [['role' => 'system', 'content' => $prompt]],
        $messages
    );

    // Grok supports same vision format as OpenAI
    if ($imageDataUrl) {
        for ($i = count($msgs) - 1; $i >= 0; $i--) {
            if ($msgs[$i]['role'] === 'user') {
                $textContent = is_string($msgs[$i]['content'])
                    ? $msgs[$i]['content']
                    : '';
                $msgs[$i]['content'] = [
                    ['type' => 'text',      'text' => $textContent],
                    ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl]],
                ];
                break;
            }
        }
    }

    $payload = json_encode([
        'model'      => GROK_MODEL,
        'max_tokens' => 300,
        'messages'   => $msgs,
    ]);

    [$raw, $status] = curlPost(
        'https://api.x.ai/v1/chat/completions',
        $payload,
        ['Content-Type: application/json', 'Authorization: Bearer ' . $key]
    );
    if ($status !== 200) { http_response_code($status); return $raw; }
    $content = json_decode($raw, true)['choices'][0]['message']['content'] ?? '';
    return parseAndWrap($raw, $content);
}

function callGemini(string $prompt, array $messages, ?string $imageBase64): string {
    $key = GEMINI_API_KEY;

    $contents = array_map(fn($m) => [
        'role'  => $m['role'] === 'assistant' ? 'model' : 'user',
        'parts' => [['text' => $m['content']]],
    ], $messages);

    // If image present, add inlineData to the last user message parts
    if ($imageBase64 && !empty($contents)) {
        for ($i = count($contents) - 1; $i >= 0; $i--) {
            if ($contents[$i]['role'] === 'user') {
                $contents[$i]['parts'][] = [
                    'inlineData' => [
                        'mimeType' => 'image/jpeg',
                        'data'     => $imageBase64,
                    ],
                ];
                break;
            }
        }
    }

    $payload = json_encode([
        'systemInstruction' => ['parts' => [['text' => $prompt]]],
        'contents'          => $contents,
        'generationConfig'  => ['maxOutputTokens' => 300],
    ]);

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
         . GEMINI_MODEL . ':generateContent?key=' . $key;

    [$raw, $status] = curlPost($url, $payload, ['Content-Type: application/json']);
    if ($status !== 200) { http_response_code($status); return $raw; }

    $gemData = json_decode($raw, true);
    $content = $gemData['candidates'][0]['content']['parts'][0]['text'] ?? '';

    // Normalize to OpenAI shape so JS doesn't need to change
    $normalized = json_encode([
        'choices' => [['message' => ['content' => $content]]],
        'command' => null,
    ]);
    return parseAndWrap($normalized, $content);
}
