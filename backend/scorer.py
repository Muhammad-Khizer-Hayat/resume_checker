"""
LLM-based resume/job-description scoring.

Uses the Groq API (fast + free-tier friendly) to compare a resume against
a job description and return a structured match report. Swap MODEL or the
client setup below if you'd rather use OpenAI/Anthropic — the prompt and
JSON contract stay the same.

Note on determinism: temperature=0 + a fixed seed make repeated calls
*mostly* consistent, but Groq's own docs describe seed as best-effort, not
a hard guarantee — their inference backend can still introduce small
floating-point differences between runs. main.py works around this by
caching results per exact input, so identical (resume, title, JD) always
returns the identical cached report instead of calling the model again.
"""

import os
import json
import re

from groq import Groq

MODEL = os.environ.get("RESUMEFIT_MODEL", "openai/gpt-oss-20b")

SYSTEM_PROMPT = """You are an expert technical recruiter and ATS (Applicant \
Tracking System) analyst. You compare a candidate's resume against a job \
description and produce an honest, specific match report.

Respond with ONLY a single JSON object — no markdown fences, no commentary \
before or after it. The JSON must match this exact shape:

{
  "match_score": <integer 0-100, overall fit>,
  "grade": <one of "A", "B", "C", "D", "F">,
  "breakdown": {
    "skill_match": <integer 0-100>,
    "experience_fit": <integer 0-100>,
    "requirement_fit": <integer 0-100>
  },
  "matched_keywords": [<strings — skills/terms from the JD that the resume \
covers, most important first, max 16>],
  "missing_keywords": [<strings — important JD skills/terms the resume is \
missing, most important first, max 10>],
  "strengths": [<2-4 short strings — specific, concrete strengths of this \
resume for this specific role>],
  "gaps": [<2-4 short strings — specific, concrete gaps or risks a \
reviewer would flag>],
  "summary": <one or two sentence plain-language verdict>
}

Ground every field in the actual text provided. Be specific to this job \
description, not generic. Do not invent skills the resume doesn't mention."""


class ScoringError(Exception):
    pass


def score_resume(resume_text: str, job_title: str, job_description: str) -> dict:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ScoringError(
            "GROQ_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )

    client = Groq(api_key=api_key)

    user_prompt = f"""JOB TITLE: {job_title}

JOB DESCRIPTION:
{_truncate(job_description, 6000)}

CANDIDATE RESUME:
{_truncate(resume_text, 8000)}"""

    last_report = None
    for attempt in range(2):  # one retry if the model returns a degenerate result
        try:
            completion = client.chat.completions.create(
                model=MODEL,
                temperature=0,
                seed=42,
                top_p=1,
                max_tokens=1500,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as e:
            raise ScoringError(f"AI request failed: {e}")

        raw = completion.choices[0].message.content
        data = _parse_json(raw)
        report = _validate_and_clean(data)
        last_report = report

        if not _is_degenerate(report):
            return report

    # Both attempts came back empty/degenerate — return what we have rather
    # than fail outright, so the user at least sees the score.
    return last_report


def _is_degenerate(report: dict) -> bool:
    """True if the model gave scores but skipped every list field —
    a sign it didn't fully follow the JSON contract for this call."""
    has_score = report.get("match_score", 0) > 0
    lists_empty = (
        not report["matched_keywords"]
        and not report["missing_keywords"]
        and not report["strengths"]
        and not report["gaps"]
    )
    return has_score and lists_empty


def _truncate(text: str, max_chars: int) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...[truncated]"


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    # Defensive: strip markdown fences if the model adds them anyway.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ScoringError(f"AI returned invalid JSON: {e}")


def _validate_and_clean(data: dict) -> dict:
    def clamp(v, default=0):
        try:
            return max(0, min(100, int(v)))
        except (TypeError, ValueError):
            return default

    breakdown = data.get("breakdown") or {}

    cleaned = {
        "match_score": clamp(data.get("match_score")),
        "grade": data.get("grade") if data.get("grade") in ("A", "B", "C", "D", "F") else "C",
        "breakdown": {
            "skill_match": clamp(breakdown.get("skill_match")),
            "experience_fit": clamp(breakdown.get("experience_fit")),
            "requirement_fit": clamp(breakdown.get("requirement_fit")),
        },
        "matched_keywords": list(data.get("matched_keywords") or [])[:16],
        "missing_keywords": list(data.get("missing_keywords") or [])[:10],
        "strengths": list(data.get("strengths") or [])[:4],
        "gaps": list(data.get("gaps") or [])[:4],
        "summary": str(data.get("summary") or "").strip(),
    }
    return cleaned
