# Farmly AI backend

The Python backend stays in the project root so it works with the current repository layout.

## 1. Create your local environment

From the `Farmly-AI` project root in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, run this once in the same terminal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## 2. Add API keys

Copy `.env.example` to `.env`, then add your real keys:

```env
GROQ_API_KEY=your_real_groq_key
GROQ_MODEL=openai/gpt-oss-120b
SARVAM_API_KEY=your_real_sarvam_key
```

Do not upload `.env` to GitHub or share it. Keep `.env.example` as placeholders only.

## 3. Start the backend

From the project root, with `.venv` active:

```powershell
python -m uvicorn main:app --reload
```

Check:
- API health: http://127.0.0.1:8000/health
- Interactive API docs: http://127.0.0.1:8000/docs

## 4. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The frontend calls the backend at `http://localhost:8000` by default.

If the backend is hosted somewhere else, create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain
```

Restart the Next.js dev server after changing this value.

## API endpoints

- `GET /health` — backend health check
- `POST /api/chat` — Groq-powered agricultural answer and English translation
- `POST /voice/transcribe` — Sarvam speech-to-text (audio upload)
- `POST /voice/speak` — Sarvam text-to-speech (MP3 response)

The voice screen uses browser speech recognition for microphone input, Groq for the answer, and Sarvam for spoken output. Browser speech recognition support varies by browser. The Sarvam transcription endpoint is also available for a future fully Sarvam-powered recording flow.
