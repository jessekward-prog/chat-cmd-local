import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const BASE_URL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234';
const MODEL = process.env.LM_STUDIO_MODEL || '';

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const body = { messages, stream: false };
  if (MODEL) body.model = MODEL;

  const upstream = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  res.json({ content: data.choices[0].message.content });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`chat-cmd-local running on http://localhost:${PORT}`));
