FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip wget \
    && pip3 install --break-system-packages piper-tts \
    && mkdir -p /app/voices/en/en_US/hfc_female/medium \
    && wget -q -O /app/voices/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx \
       "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx" \
    && wget -q -O /app/voices/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json \
       "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json" \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

ENV PIPER_CMD=piper
ENV PIPER_MODEL=/app/voices/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx
ENV LM_STUDIO_BASE_URL=http://10.0.1.1:1234
ENV PORT=3007
EXPOSE 3007

CMD ["node", "server.js"]
