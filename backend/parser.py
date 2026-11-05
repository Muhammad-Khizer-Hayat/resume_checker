"""
Text extraction for uploaded resumes.

Supports .pdf (via pypdf) and plain-text formats (.txt, .md). Anything else
is rejected with a clear error so the caller can show it to the user.
"""

import io

from pypdf import PdfReader

SUPPORTED_TEXT_EXTENSIONS = (".txt", ".md")


def extract_text(filename: str, raw_bytes: bytes) -> str:
    name = (filename or "").lower()

    if name.endswith(".pdf"):
        return _extract_pdf_text(raw_bytes)

    if name.endswith(SUPPORTED_TEXT_EXTENSIONS):
        return raw_bytes.decode("utf-8", errors="ignore")

    # Fall back: try decoding as text before giving up, in case the
    # filename has no/odd extension but the content is plain text.
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError(
            "Unsupported resume format. Please upload a PDF or a plain-text file."
        )


def _extract_pdf_text(raw_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(raw_bytes))
    except Exception as e:
        raise ValueError(f"Could not read PDF: {e}")

    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            continue

    return "\n".join(pages)
