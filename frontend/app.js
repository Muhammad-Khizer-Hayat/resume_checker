// Point this at your running backend. Defaults to local dev.
const API_BASE = "http://127.0.0.1:8000";

const form = document.getElementById("analyze-form");
const dropzone = document.getElementById("dropzone");
const dropzoneLabel = document.getElementById("dropzone-label");
const fileInput = document.getElementById("resume_file");
const submitBtn = document.getElementById("submit-btn");
const errorBox = document.getElementById("error-box");

const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const reportEl = document.getElementById("report");

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "var(--primary)";
});
dropzone.addEventListener("dragleave", () => {
  dropzone.style.borderColor = "";
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "";
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    updateDropzoneLabel();
  }
});

fileInput.addEventListener("change", updateDropzoneLabel);

function updateDropzoneLabel() {
  if (fileInput.files.length) {
    dropzoneLabel.textContent = fileInput.files[0].name;
    dropzone.classList.add("has-file");
  } else {
    dropzoneLabel.textContent = "Click to upload, or drag a file here";
    dropzone.classList.remove("has-file");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const jobTitle = document.getElementById("job_title").value.trim();
  const jobDescription = document.getElementById("job_description").value.trim();
  const file = fileInput.files[0];

  if (!file) {
    showError("Please attach a resume file.");
    return;
  }

  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("job_description", jobDescription);
  formData.append("resume", file);

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Something went wrong analyzing your resume.");
    }

    renderReport(data, jobTitle);
  } catch (err) {
    showError(err.message || "Could not reach the backend. Is it running?");
    emptyState.style.display = "flex";
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Analyzing…" : "Analyze match";
  loadingState.style.display = isLoading ? "flex" : "none";
  if (isLoading) {
    emptyState.style.display = "none";
    reportEl.style.display = "none";
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
}
function hideError() {
  errorBox.style.display = "none";
}

function renderReport(data, jobTitle) {
  const titleText = jobTitle ? `Match report — ${jobTitle}` : "Match report";
  const titleEl = document.getElementById("report-title");
  if (window.scrambleText) {
    window.scrambleText(titleEl, titleText, 500);
  } else {
    titleEl.textContent = titleText;
  }
  document.getElementById("report-summary").textContent =
    `Grade ${data.grade} · ${data.match_score}% overall match`;

  animateRing(data.match_score);
  animateCount(document.getElementById("score-number"), data.match_score);

  setBar("skill", data.breakdown.skill_match);
  setBar("exp", data.breakdown.experience_fit);
  setBar("req", data.breakdown.requirement_fit);

  fillKeywords("matched-keywords", data.matched_keywords, "tag-match");
  fillKeywords("missing-keywords", data.missing_keywords, "tag-gap");
  document.getElementById("matched-count").textContent = `${data.matched_keywords.length} found`;
  document.getElementById("missing-count").textContent = `${data.missing_keywords.length} missing`;

  fillList("strengths-list", data.strengths);
  fillList("gaps-list", data.gaps);

  document.getElementById("summary-text").textContent = data.summary;

  emptyState.style.display = "none";
  reportEl.style.display = "block";
}

function animateRing(pct) {
  const ring = document.getElementById("score-ring");
  requestAnimationFrame(() => {
    ring.style.setProperty("--pct", pct);
  });
}

function animateCount(el, target) {
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setBar(key, value) {
  document.getElementById(`bd-${key}`).textContent = `${value}%`;
  requestAnimationFrame(() => {
    document.getElementById(`bar-${key}`).style.width = `${value}%`;
  });
}

function fillKeywords(containerId, items, cssClass) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<span class="kw-count">None found</span>`;
    return;
  }
  items.forEach((kw, i) => {
    const span = document.createElement("span");
    span.className = `tag ${cssClass}`;
    span.textContent = kw;
    span.style.animationDelay = `${i * 35}ms`;
    container.appendChild(span);
  });
}

function fillList(containerId, items) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!items.length) {
    el.innerHTML = "<li>Nothing notable flagged.</li>";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  });
}
