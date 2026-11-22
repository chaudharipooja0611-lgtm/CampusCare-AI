"""Text preprocessing and lexicon-based sentiment analysis."""
import math
import re

_STRIP = re.compile(r"[^a-z0-9\s']")
_SPACE = re.compile(r"\s+")


def clean_text(text):
    text = (text or "").lower()
    text = _STRIP.sub(" ", text)
    return _SPACE.sub(" ", text).strip()


NEGATIVE = {
    # strong (-2)
    "unacceptable": -2, "terrible": -2, "horrible": -2, "worst": -2, "disgusting": -2, "pathetic": -2,
    "furious": -2, "harassment": -2, "ragging": -2, "dangerous": -2, "fed up": -2, "negligence": -2,
    "unsafe": -2, "emergency": -2, "worse": -2, "useless": -2, "ridiculous": -2, "scared": -2,
    # normal (-1)
    "not working": -1, "broken": -1, "problem": -1, "issue": -1, "delay": -1, "delayed": -1, "pending": -1,
    "leaking": -1, "failed": -1, "failure": -1, "cannot": -1, "unable": -1, "poor": -1, "bad": -1,
    "dirty": -1, "noisy": -1, "missing": -1, "wrong": -1, "stuck": -1, "crashed": -1, "down": -1,
    "angry": -1, "frustrated": -1, "frustrating": -1, "disappointed": -1, "tired": -1, "overflowing": -1,
    "locked": -1, "blocked": -1, "weak": -1, "damaged": -1, "no response": -1, "ignored": -1, "stolen": -1,
    "theft": -1, "injured": -1, "fire": -1, "urgent": -1, "urgently": -1, "complaint": -1,
}
POSITIVE = {
    "thank": 1, "thanks": 1, "thankful": 1, "grateful": 1, "appreciate": 1, "good": 1, "great": 1,
    "excellent": 2, "helpful": 1, "happy": 1, "satisfied": 1, "please": 0.3, "kindly": 0.3, "suggest": 0.5,
    "request": 0.3, "improve": 0.5, "nice": 1, "wonderful": 2,
}


def analyze_sentiment(text):
    """Returns {label, score} where score is in (-1, 1)."""
    t = " " + clean_text(text) + " "
    total = 0.0
    for term, val in NEGATIVE.items():
        total += val * len(re.findall(rf"\b{re.escape(term)}\b", t))
    for term, val in POSITIVE.items():
        hits = len(re.findall(rf"\b{re.escape(term)}\b", t))
        negated = len(re.findall(rf"\b(?:not|no|never)\s+{re.escape(term)}\b", t))
        total += val * (hits - negated) - val * negated
    score = total / (abs(total) + 2.0)
    label = "Negative" if score <= -0.25 else "Positive" if score >= 0.25 else "Neutral"
    return {"label": label, "score": round(score, 3)}
