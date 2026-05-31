import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import 'dotenv/config';

const PIPER_CMD   = process.env.PIPER_CMD   || 'piper';
const PIPER_MODEL = process.env.PIPER_MODEL || `${os.homedir()}/.local/share/piper/en/en_GB/cori/high/en_GB-cori-high.onnx`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const BASE_URL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234';
const MODEL = process.env.LM_STUDIO_MODEL || '';

const SYSTEM_PROMPT_SHORT = {
  role: 'system',
  content: 'You are a friendly helper for young children aged 4 to 7. Give very short answers — 2 sentences maximum. Use the simplest everyday words a young child would know. Never use scientific or technical terms unless they are the actual common name of the thing (like "gravity" or "lightning"). Always use Australian English — say torch not flashlight, lollies not candy, bin not trash can, footpath not sidewalk.',
};

const SYSTEM_PROMPT_MORE = {
  role: 'system',
  content: 'You are a friendly helper for young children aged 4 to 7. Give a fuller explanation in about 4 to 5 sentences. Use the simplest everyday words a young child would know — be warm and fun. Never use scientific or technical terms unless they are the actual common name of the thing. Always use Australian English — say torch not flashlight, lollies not candy, bin not trash can, footpath not sidewalk.',
};

const toTwoSentences = (text) => {
  const sentences = text.match(/[^.!?]*[.!?]+/g);
  if (!sentences) return text.trim();
  return sentences.slice(0, 2).join(' ').trim();
};

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const body = { messages: [SYSTEM_PROMPT_SHORT, ...messages], stream: false, max_tokens: 1024 };
  if (MODEL) body.model = MODEL;

  const upstream = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  res.json({ content: toTwoSentences(data.choices[0].message.content) });
});

app.post('/api/chat-more', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'missing question' });

  const body = {
    messages: [SYSTEM_PROMPT_MORE, { role: 'user', content: question }],
    stream: false,
    max_tokens: 2048,
  };
  if (MODEL) body.model = MODEL;

  const upstream = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  res.json({ content: data.choices[0].message.content });
});

app.post('/api/speak', async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text || text.length > 500) return res.status(400).json({ error: 'invalid_text' });

  const outFile = join(os.tmpdir(), `piper_${randomUUID()}.wav`);
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(PIPER_CMD, ['--model', PIPER_MODEL, '--output_file', outFile]);
      proc.stdin.write(text);
      proc.stdin.end();
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`piper exited ${code}`))));
      proc.on('error', reject);
    });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    const stream = createReadStream(outFile);
    res.on('finish', () => unlink(outFile).catch(() => {}));
    res.on('close',  () => unlink(outFile).catch(() => {}));
    stream.pipe(res);
  } catch (err) {
    console.error('[api/speak]', err?.message || err);
    unlink(outFile).catch(() => {});
    res.status(502).json({ error: 'tts_unavailable' });
  }
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`chat-cmd-local running on http://localhost:${PORT}`));
