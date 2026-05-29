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

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'You are a friendly, curious helper. Always give short answers — 3 sentences at most. Explain the real reason something happens using everyday words. Only use a technical or scientific name if it is the actual name of the thing (like "atmosphere" or "gravity") — otherwise use plain words and a simple comparison instead. Always use Australian English — say torch not flashlight, lollies not candy, bin not trash can, footpath not sidewalk, and so on.',
};

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const body = { messages: [SYSTEM_PROMPT, ...messages], stream: false };
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
