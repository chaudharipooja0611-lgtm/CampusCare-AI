"""Inference helpers: classification, priority, sentiment and duplicate detection."""
import json
import os
import threading

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ml.nlp import clean_text, analyze_sentiment  # noqa: F401  (re-exported)
from ml import train as trainer

URGENT_TERMS = ["fire", "spark", "sparks", "burning", "smoke", "shock", "live wire", "live wires", "flood", "flooded",
                "burst", "harassment", "ragging", "injured", "injury", "accident", "emergency", "theft", "stolen",
                "gas leak", "collapse", "dangerous", "danger", "threat", "hospital", "immediately", "urgently", "urgent"]

_models = {}
_lock = threading.Lock()


def load(force=False):
    with _lock:
        if force or not _models:
            cat_path = os.path.join(trainer.MODEL_DIR, "category_model.joblib")
            if not os.path.exists(cat_path) or force:
                trainer.train()
            _models["category"] = joblib.load(cat_path)
            _models["priority"] = joblib.load(os.path.join(trainer.MODEL_DIR, "priority_model.joblib"))
    return _models


def retrain():
    metrics = trainer.train()
    load(force=True)
    return metrics


def get_metrics():
    path = os.path.join(trainer.MODEL_DIR, "metrics.json")
    if not os.path.exists(path):
        load()
    with open(path) as f:
        return json.load(f)


def _explain(pipe, text, top=6):
    """Explains a Naive Bayes decision from the trained model itself.

    For a multinomial NB the log-score of class c is  log P(c) + sum_t x_t * log P(t|c),
    where x_t is the TF-IDF weight of term t. The contribution of term t towards the predicted
    class c versus the runner-up class r is therefore  x_t * (log P(t|c) - log P(t|r)).
    Summing all contributions plus the prior difference gives the exact log-odds margin.
    """
    vec, nb = pipe.steps[0][1], pipe.steps[-1][1]
    X = vec.transform([text]).tocsr()
    proba = nb.predict_proba(X)[0]
    order = proba.argsort()[::-1]
    c, r = int(order[0]), int(order[1])
    idx, w = X.indices, X.data
    names = vec.get_feature_names_out()
    delta = nb.feature_log_prob_[c, idx] - nb.feature_log_prob_[r, idx]
    contrib = w * delta
    total = float(abs(contrib).sum()) or 1.0
    items = [{"term": str(names[i]), "weight": round(float(v) / total * 100, 1)} for i, v in zip(idx, contrib)]
    items.sort(key=lambda t: -abs(t["weight"]))
    support = [t for t in items if t["weight"] > 0][:top]
    against = [t for t in items if t["weight"] < 0][:3]
    unigrams = [t for t in vec.build_analyzer()(text) if " " not in t]
    known = sum(1 for t in unigrams if t in vec.vocabulary_)
    return {
        "predicted": str(nb.classes_[c]), "runner_up": str(nb.classes_[r]),
        "runner_up_confidence": round(float(proba[r]) * 100, 1),
        "margin": round(float(contrib.sum() + nb.class_log_prior_[c] - nb.class_log_prior_[r]), 2),
        "supporting_terms": support, "opposing_terms": against,
        "vocabulary_coverage": round(100 * known / len(unigrams), 1) if unigrams else 0.0,
        "matched_terms": len(items),
    }


def predict(text):
    m = load()
    cat_model, pri_model = m["category"], m["priority"]
    cat_proba = cat_model.predict_proba([text])[0]
    i = int(cat_proba.argmax())
    pri_proba = pri_model.predict_proba([text])[0]
    j = int(pri_proba.argmax())
    priority = pri_model.classes_[j]
    reason = "model"
    cleaned = " " + clean_text(text) + " "
    urgent = [t for t in URGENT_TERMS if f" {t} " in cleaned]
    if priority != "High" and urgent:
        priority, reason = "High", "urgent-keyword"
    cat_exp, pri_exp = _explain(cat_model, text), _explain(pri_model, text)
    pri_exp["model_priority"] = str(pri_model.classes_[j])
    pri_exp["urgent_keywords"] = urgent
    pri_exp["final_priority"] = str(priority)
    return {
        "category": str(cat_model.classes_[i]),
        "confidence": round(float(cat_proba[i]) * 100, 1),
        "probabilities": {str(c): round(float(p) * 100, 1) for c, p in zip(cat_model.classes_, cat_proba)},
        "priority": str(priority),
        "priority_confidence": round(float(pri_proba[j]) * 100, 1),
        "priority_reason": reason,
        "explanation": {"category": cat_exp, "priority": pri_exp},
    }


def find_duplicates(text, candidates, threshold=0.5, top=3):
    """candidates: list of dicts with id, ticket_id, title, text. Uses TF-IDF cosine similarity."""
    if not candidates:
        return []
    docs = [text] + [c["text"] for c in candidates]
    vec = TfidfVectorizer(preprocessor=clean_text, ngram_range=(1, 2), sublinear_tf=True).fit(docs)
    sims = cosine_similarity(vec.transform([text]), vec.transform(docs[1:]))[0]
    hits = []
    for c, s in zip(candidates, sims):
        if s >= threshold:
            hits.append({"id": c["id"], "ticket_id": c["ticket_id"], "title": c["title"],
                         "status": c.get("status"), "similarity": round(float(s) * 100, 1)})
    return sorted(hits, key=lambda h: -h["similarity"])[:top]
