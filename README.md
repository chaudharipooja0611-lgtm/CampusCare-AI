# CampusCare AI – Smart Complaint Classification and Routing System  (v2)

A full-stack campus helpdesk. Students submit complaints; a **real, trained NLP model** (TF-IDF + Multinomial Naive Bayes) classifies them, detects priority, scores confidence, **explains its decision**, finds duplicates, analyses sentiment and routes each ticket to the right department — with an **SLA clock**, **automatic escalation** and **resolution ratings**.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS (navy / violet theme), Recharts, Lucide, React Router |
| Backend | Python Flask, PyJWT, PyMySQL |
| AI / ML | scikit-learn (TF-IDF + MultinomialNB), NumPy, joblib |
| Database | MySQL 8 (MariaDB 10.6+ also works) |

## What's new in v2
| Feature | How it works |
|---|---|
| **SLA countdown & overdue alerts** | Every complaint gets a deadline from its priority (default High 24 h · Medium 72 h · Low 168 h, configurable in `.env`). Live countdowns in tables and on the detail page. A background monitor warns when <20 % of the window is left, flags breaches, and alerts the department, admins and the student – exactly once per event. |
| **Automatic escalation** | Level 1 on submission when a High-priority complaint is a Safety issue, contains hazard keywords (fire, sparks, shock…) or has strongly negative sentiment; on SLA breach of a High complaint; and Level 2 ("critical") when any open complaint is overdue by a full extra SLA window. Departments/admins can also escalate manually with a reason. |
| **Resolution ratings** | The owning student rates a *Resolved* complaint 1–5 with optional feedback (once). Low ratings alert admins. Ratings feed dashboards, analytics and CSV. Admins can reopen a closed complaint. |
| **Smart notification center** | Typed, severity-ranked notifications (critical → warning → info), critical-first ordering, bell dropdown, full page with All / Unread / Alerts tabs, per-item read & delete, mark-all-read, clear-read, live toast for new alerts. |
| **Advanced search, filters, CSV export** | Search across ticket/title/description/location/student; filter by status, category, priority, sentiment, department, date range, AI confidence, rating, and quick chips (overdue, escalated, low confidence, duplicates, AI-corrected, awaiting rating); sortable columns; server-side pagination; one-click **CSV export** of exactly the filtered set, plus a **summary report CSV** (KPIs, SLA, departments). CSV cells are protected against spreadsheet formula injection. |
| **AI explainability** | For every prediction the UI shows the words that drove the decision, each term's share of the evidence for the predicted class vs the runner-up, opposing terms, the decision margin, vocabulary coverage, and why the priority was chosen. This is computed from the trained Naive Bayes parameters (log P(term|class) × TF-IDF weight) — not generated text. |
| **Premium UI** | Navy sidebar SaaS shell, global search, skeleton loaders, animated cards/charts, redesigned landing, login and registration (password-strength meter), error boundary and 404 page. |

All v1 features and APIs are unchanged (auth & roles, submission with image upload, classification, routing, priority, confidence, ticket IDs & public tracking, status updates, admin/department dashboards, analytics, duplicates, sentiment, admin correction, model retraining).

## Project structure
```
campuscare-ai/
├── database/schema.sql              # full schema (fresh installs)
├── backend/
│   ├── app.py                       # Flask factory, security headers, SLA worker
│   ├── config.py  db.py  security.py  utils.py
│   ├── migrate.py                   # in-place, non-destructive upgrade of existing databases
│   ├── services.py                  # routing, escalation, notifications, SLA monitor
│   ├── init_db.py                   # schema + demo users + sample complaints
│   ├── routes/                      # auth, complaints, admin, analytics (+notifications, reports)
│   ├── ml/                          # dataset generator, training, classifier + explainability, NLP
│   └── tests/test_api.py            # 69-check end-to-end API test
└── frontend/                        # Vite + React + Tailwind
```

## Setup
Prerequisites: Python 3.10+, Node 18+, MySQL 8 running locally.

```bash
# 1) Backend
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # set DB_PASSWORD and a long random SECRET_KEY
python init_db.py                                     # schema, demo users, sample complaints
python app.py                                         # http://localhost:5000

# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev                                           # http://localhost:5173
```
The model trains automatically on first start. Production: `npm run build`, serve `dist/` and proxy `/api` to Flask (e.g. gunicorn).

### Upgrading an existing v1 install
Just pull the new code and start the backend. `migrate.py` runs on startup and adds the new columns (SLA, escalation, ratings, explanations, notification types) **without touching existing data**, then back-fills an SLA deadline for every existing complaint. Your trained model files are untouched. Notes: existing open complaints older than their SLA will be flagged overdue on the first monitor run (that is the feature working); the stronger password policy applies to new registrations only.

### Configuration (`backend/.env`)
`SLA_HOURS_HIGH / MEDIUM / LOW`, `SLA_WORKER` (1/0), `SLA_INTERVAL_SECONDS` (default 60), plus `SECRET_KEY`, DB settings and `CORS_ORIGINS`. With several server workers the monitor is still safe: every alert is claimed atomically in SQL.

## Demo accounts (from `init_db.py`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@campuscare.edu | admin123 |
| Department (IT) | it@campuscare.edu | dept123 |
| Other departments | electrical@ / maintenance@ / accounts@ / safety@ / library@campuscare.edu | dept123 |
| Student | student@campuscare.edu / priya@campuscare.edu | student123 |

Change these before any real deployment. New passwords must be 8+ characters with a letter and a number.

## REST API (all under `/api`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/register`, `/auth/login` (rate-limited) · GET `/auth/me` | public / user |
| GET | `/config` (SLA targets) · `/health` | public |
| POST | `/complaints/predict` – live AI preview incl. explanation & SLA | public (duplicates if logged in) |
| POST | `/complaints` (multipart, image validated by content) | user |
| GET | `/complaints` – filters `q status category priority sentiment department_id date_from date_to min_confidence rating_max overdue escalated attention duplicate corrected low_confidence unrated rated`, `sort order page per_page` | role-scoped |
| GET | `/complaints/export` – same filters, returns CSV | role-scoped |
| GET | `/complaints/<id>` (incl. SLA, explanation, timeline) · `/track/<ticket>` | owner/dept/admin · public |
| PATCH | `/complaints/<id>/status` | admin, assigned dept (reopen: admin) |
| PATCH | `/complaints/<id>/correct` (re-routes, recalculates SLA) | admin |
| POST | `/complaints/<id>/escalate` · `/complaints/<id>/rating` | admin/dept · owner student |
| GET | `/analytics` · `/reports/summary` (CSV) | role-scoped · admin/dept |
| GET/POST/DELETE | `/notifications` (`filter=all|unread|alerts`), `/notifications/read`, `/notifications/<id>/read`, `DELETE /notifications/<id>` | user |
| CRUD | `/departments`, `/users` · POST `/admin/retrain`, `/admin/sla-check` | admin |

## About the ML model
* **Training data is synthetic** (`ml/data/complaints.csv`, ~5.9 k rows generated by `ml/generate_dataset.py`). Reported accuracy (≈ 95 % category, ≈ 99 % priority) uses group-aware splits that hold out whole complaint templates, so it reflects unseen wording — but real campus complaints are messier. Add real labelled rows (`text,category,priority`) and retrain for production.
* Every admin correction is stored in `ml/data/feedback.csv`; **Analytics → Retrain model** learns from it.
* Priority = Naive Bayes prediction, raised to High when hazard keywords are present. Sentiment is a transparent lexicon (not ML). Duplicates use TF-IDF cosine similarity (≥ 0.5) over complaints open in the last 30 days.
* Explanations describe the model's actual arithmetic; they show *what the model weighed*, not causal truth about the complaint.

## Security
Hashed passwords, 12 h JWTs, server-side role checks on every endpoint, per-IP rate limits (login, register, predict, submit, export, track), password policy, parameterised SQL everywhere, whitelisted sort/filter values, uploads validated by file signature and stored under random names with restrictive headers, 5 MB limit, CSV formula-injection neutralisation, security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `no-store`) and a startup warning for the default `SECRET_KEY`. Serve over HTTPS and set a strong `SECRET_KEY` in production. Uploaded images are reachable by their unguessable URL (they are `<img>` sources); put them behind signed URLs if you need stricter privacy.

## Tests
`backend/tests/test_api.py` runs 69 end-to-end checks (auth, RBAC, SLA monitor idempotency, escalation, ratings, filters, CSV, notifications, security). Run it against a development database only.
