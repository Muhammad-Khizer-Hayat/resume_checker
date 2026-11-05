"""
ResumeFit backend — FastAPI app.

Exposes POST /api/analyze which accepts a resume file (PDF or plain text)
plus a job title and job description, and returns an AI-generated match
report: overall score, breakdown, matched/missing keywords, and feedback.
"""

import os
import json
import logging
import hashlib

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from parser import extract_text
from scorer import score_resume, ScoringError

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resumefit")

app = FastAPI(title="ResumeFit API", version="1.0.0")

# Allow the static frontend (served from file:// or any local dev server)
# to call this API. Tighten this to your real domain before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-memory result cache -------------------------------------------------
# LLM calls aren't fully deterministic even at temperature=0 with a fixed
# seed (the drift comes from floating-point rounding and request batching on
# the provider's side, not from anything in this code). Rather than fight
# that, we cache by a hash of the exact inputs: the *same* resume + job
# title + job description will always return the *same* saved report for as
# long as this process stays up. A genuinely different input still gets a
# fresh LLM call.
_cache: dict[str, dict] = {}
_CACHE_MAX_ENTRIES = 200


def _cache_key(job_title: str, job_description: str, resume_text: str) -> str:
    raw = "::".join(
        [job_title.strip().lower(), job_description.strip(), resume_text.strip()]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _remember(key: str, report: dict) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        _cache.pop(next(iter(_cache)))  # drop the oldest entry
    _cache[key] = report


@app.get("/")
def root():
    return {
        "message": "ResumeFit API is running. This endpoint has no UI.",
        "frontend": "Open frontend/index.html (served separately) in your browser.",
        "health_check": "/api/health",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    job_title: str = Form(...),
    job_description: str = Form(...),
    resume: UploadFile = File(...),
):
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is empty.")

    raw_bytes = await resume.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    try:
        resume_text = extract_text(resume.filename, raw_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from that resume file.",
        )

    key = _cache_key(job_title, job_description, resume_text)
    if key in _cache:
        return _cache[key]

    try:
        report = score_resume(
            resume_text=resume_text,
            job_title=job_title,
            job_description=job_description,
        )
    except ScoringError as e:
        logger.error("Scoring failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))

    _remember(key, report)
    return report


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
