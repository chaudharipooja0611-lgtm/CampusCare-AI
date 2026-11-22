"""Train TF-IDF + Multinomial Naive Bayes models for category and priority.

Run:  python -m ml.train
"""
import csv
import datetime
import json
import os

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_val_score
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

from ml.nlp import clean_text

ML_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ML_DIR, "data", "complaints.csv")
FEEDBACK_FILE = os.path.join(ML_DIR, "data", "feedback.csv")
MODEL_DIR = os.path.join(ML_DIR, "models")


def load_rows():
    rows = []
    for path in (DATA_FILE, FEEDBACK_FILE):
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8") as f:
                rows += [r for r in csv.DictReader(f) if r.get("text") and r.get("category") and r.get("priority")]
    return rows


def build():
    return make_pipeline(
        TfidfVectorizer(preprocessor=clean_text, ngram_range=(1, 2), sublinear_tf=True),
        MultinomialNB(alpha=0.1),
    )


def evaluate(texts, labels, groups):
    """Group-aware evaluation: all variants of one base complaint stay on the same side
    of the split, so scores measure generalisation to unseen complaint wording."""
    texts, labels, groups = np.array(texts, dtype=object), np.array(labels), np.array(groups)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(texts, labels, groups))
    model = build().fit(texts[tr], labels[tr])
    report = classification_report(labels[te], model.predict(texts[te]), output_dict=True, zero_division=0)
    cv = cross_val_score(build(), texts, labels, cv=GroupKFold(5), groups=groups)
    return {"accuracy": round(report["accuracy"], 4), "cv_mean": round(float(np.mean(cv)), 4),
            "per_class_f1": {k: round(v["f1-score"], 3) for k, v in report.items() if isinstance(v, dict) and k not in ("macro avg", "weighted avg")}}


def train():
    rows = load_rows()
    if len(rows) < 50:
        raise RuntimeError("Not enough training data. Run: python -m ml.generate_dataset")
    texts = [r["text"] for r in rows]
    cats = [r["category"] for r in rows]
    pris = [r["priority"] for r in rows]
    groups = [r.get("group") or f"fb{i}" for i, r in enumerate(rows)]
    metrics = {"samples": len(rows), "category": evaluate(texts, cats, groups), "priority": evaluate(texts, pris, groups),
               "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "feedback_samples": sum(1 for _ in open(FEEDBACK_FILE)) - 1 if os.path.exists(FEEDBACK_FILE) else 0}
    # final models are fitted on 100% of the data
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(build().fit(texts, cats), os.path.join(MODEL_DIR, "category_model.joblib"))
    joblib.dump(build().fit(texts, pris), os.path.join(MODEL_DIR, "priority_model.joblib"))
    with open(os.path.join(MODEL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    return metrics


if __name__ == "__main__":
    m = train()
    print(json.dumps(m, indent=2))
