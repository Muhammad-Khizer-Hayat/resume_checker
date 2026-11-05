# ResumeFit

An AI-powered resume ↔ job description match analyzer: a landing page plus a
working app that scores a resume against a job description using an LLM, and
shows a breakdown, matched/missing keywords, strengths, and gaps.

```
resumefit/
├── backend/
│   ├── main.py           FastAPI app, /api/analyze endpoint
│   ├── parser.py         Resume text extraction (PDF/txt)
│   ├── scorer.py         LLM scoring via Groq
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── index.html        Landing page
    ├── app.html          The actual match-checker dashboard
    ├── app.js
    └── styles.css
```

## 1. Backend setup

```powershell
cd backend
python -m venv venv
venv\Scripts\activate          # on Windows PowerShell
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your key:

```
GROQ_API_KEY=your_groq_api_key_here
```

Get a free key at https://console.groq.com/keys (Groq's free tier is enough
to run this — swap the client in `scorer.py` for OpenAI/Anthropic if you'd
rather use one of those instead; the JSON contract stays the same).

Run the API:

```powershell
uvicorn main:app --reload
```

It starts on `http://127.0.0.1:8000`. Check `http://127.0.0.1:8000/api/health`
to confirm it's up.

## 2. Frontend

No build step — it's plain HTML/CSS/JS. Just open `frontend/index.html` in a
browser (or serve the folder with any static server, e.g. `npx serve` or
VS Code's "Live Server" extension).

`app.js` calls the backend at `http://127.0.0.1:8000` by default — change
`API_BASE` at the top of that file if you deploy the backend elsewhere.

## 3. Using it

1. Open `index.html` → click "Check my resume" (goes to `app.html`).
2. Paste a job title + job description.
3. Upload a resume as PDF or plain text.
4. Click "Analyze match" — the report renders on the right with a score
   ring, skill/experience/requirement breakdown, matched vs. missing
   keywords, strengths, and gaps.

## Notes / next steps

- The resume is only held in memory for the duration of the request — it's
  not written to disk or a database. Add persistence yourself if you want
  history/accounts.
- `scorer.py` uses `llama-3.3-70b-versatile` on Groq by default; override
  with the `RESUMEFIT_MODEL` env var.
- CORS is wide open (`allow_origins=["*"]`) for local development — restrict
  it before deploying publicly.
- To deploy: the backend is a standard FastAPI app (works on Railway,
  Render, Fly.io, etc.); the frontend is static and can go on Netlify,
  Vercel, GitHub Pages, or the same host as the backend.
