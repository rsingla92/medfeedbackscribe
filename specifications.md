# Requirements Specification (SRS v1.0)


Project: Debrief AI
Last Updated: November 2025
Author: Rohit Singla
Audience: Engineering & Product Team
Platform: Mobile-First Progressive Web App (PWA)

## 1. Overview & Purpose
AI-powered, privacy-compliant web application designed to automate and enhance real-time feedback assessment in medical education.
It records, transcribes, classifies, and analyzes verbal feedback between residents/students and supervisors, transforming unstructured conversation into structured assessment data.
The system eliminates manual form entry, detects potential bias, and visualizes longitudinal progress — maintaining interoperability with institutional frameworks such as *Competency by Design (CBD)* and *CanMEDS*.

### 1.1 Core Goals
* Capture high-quality audio of feedback sessions.
* Convert audio to text (Whisper API).
* Use GPT-based NLP to extract:
  * Skill Dimension (CanMEDS)
  * EPA Stage / Milestone Level
  * Domain of Care / Priority Topic
  * Sentiment / Bias Flags
* Display analytics dashboards for reflection and progression.
* Protect PHI via anonymization and post-processing audio deletion.
* Enable JSON export compatible with Entrada or One45 APIs.

### 1.2 Purpose Statement
Debrief AI serves as an **AI-powered real-time assessment companion** that passively captures conversations and automatically maps them into structured educational metrics — bridging qualitative dialogue and quantitative analytics while preserving privacy.

## 2. User Roles & Permissions
| Role                         | Permissions                                                                              |
| :--------------------------- | :--------------------------------------------------------------------------------------- |
| **Resident**                 | Start/stop recordings, tag supervisors, view summaries, analytics, and flagged sessions. |
| **Student**                  | Same as Resident.                                                                        |
| **Supervisor (Future)**      | Review sessions they authored, manage or respond to bias flags.                          |
| **Admin (Program Director)** | Access aggregated anonymized analytics (no content visibility).                          |

### Authentication
* OAuth2-based authentication.
* University-specific SSO integrations (e.g., UBC CWL, SFU, UofT, McGill, etc.).
  * Ex: UBC integration: https://confluence.it.ubc.ca/spaces/SH3E/pages/126885904/Integration+Process+Steps 
* Support for One45 / Entrada SSO (Phase 2).

## 3. Functional Requirements
### 3.1 Recording Module
* Mobile-first “Start Recording” interface.
* Optional supervisor tag & session type selector (EPA inferred automatically).
* Configurable silence timeout (default 5 min).
* Draft auto-save every 30s (IndexedDB).
* Post-recording workflow:
  * Upload to Whisper API → transcription JSON.
  * Delete raw audio post successful processing.
  * Privacy toggle “Delete Audio After Processing” (ON by default).

### 3.2 Transcription & NLP Pipeline
* Transcribes audio into timestamped text (Whisper).
* GPT model parses transcript to structured schema:
  * Skill Dimension
  * EPA Stage / Milestone Level
  * Domain of Care / Priority Topic
  * Summary
  * Bias Score / Flags
* Optional bias detector (gendered/loaded language heuristics).
* Target tagging accuracy: ≥85%.

### 3.3 Feedback & Flagging
* Sessions auto-flagged if bias_score > threshold.
* Residents can view flag rationale and submit appeal/comment.
* Admin dashboard includes flagged sessions list for manual review.

### 3.4 Analytics Dashboard
Interactive dashboards built with Chart.js, providing:
* Total sessions, weekly/monthly deltas
* Average milestone score
* EPA progression (Observation → Supervision → Trusted Action)
* Skill dimensions distribution
* Domain of Care distribution (Adults, Peds, MH, Elderly, etc.)
* Competency milestones (Novice → Expert)
* Skill trend lines (moving averages)
* Bias heatmaps & radar visualizations

### 3.5 Supervisor Management
* Residents maintain frequent-supervisor lists.
* Add/remove supervisors (name, specialty tags).
* Tags drive filter chips (Family Med, Internal Med, Peds, etc.).

### 3.6 Premium Features (Stripe v2)
* **Custom Priority Topics:** add or edit topic tags.
* **Advanced Analytics:** deeper temporal insights & bias visualization.
* Feature control managed via Stripe subscription status.

### 3.7 Notifications

* Weekly reminders for pending feedback sessions.
* Weekly performance summaries.
* Deadline alerts (EPA submissions).
* Email & push preferences configurable by user.

### 3.8 Privacy & Security

* **Share Anonymous Analytics** toggle.
* **Session Timeout:** default 1 hr.
* **Data Retention:** default 1 year (configurable).
* **Download My Data:** JSON, CSV, or PDF export.
* AES-256 encryption (at rest); TLS 1.3 (in transit).
* PHI redaction via regex and tokenization before LLM calls.

## 4. Data Model
**Core Entities**
* `User`: id, name, email, role, subscription_tier, created_at
* `Supervisor`: id, name, specialty, user_id
* `FeedbackSession`: id, user_id, supervisor_id, date, transcript_text, skill_dimension, priority_topic, domain_of_care, milestone, epa_stage, bias_score, flagged, summary
* `AnalyticsSnapshot`: id, user_id, date, metrics_json
* `Settings`: user_id, recording_timeout, data_retention, notifications_json

**Indexes:** user_id, date, skill_dimension
**Mapping Tables**
* Debrief topic → Entrada EPA_ID (for interoperability).

## 5. API Endpoints (v1)
| Method    | Route                    | Description                                |
| :-------- | :----------------------- | :----------------------------------------- |
| **POST**  | `/api/recordings/upload` | Upload audio → Whisper transcription.      |
| **POST**  | `/api/analysis/process`  | Send transcript → GPT classification.      |
| **GET**   | `/api/feedback`          | List user feedback sessions.               |
| **GET**   | `/api/analytics/summary` | Dashboard metrics.                         |
| **PATCH** | `/api/settings`          | Update preferences.                        |
| **GET**   | `/api/export`            | Export data as ZIP (JSON/CSV/PDF).         |
| **POST**  | `/api/flag/review`       | Submit appeal/comment for flagged session. |

**Authentication:** Access tokens via secure HTTP-only cookies.

## 6. System Architecture
### 6.1 Client (Frontend)
* **Framework:** React (Next.js) or Vue 3
* **UX:** Mobile-first, PWA with offline cache (IndexedDB)
* **Features:** Modular dashboards, touch-optimized cards, dynamic charts

### 6.2 Backend
* **Framework:** FastAPI (Python 3.11) or Node Express
* **Services:**
  * `transcription.py` → Whisper wrapper
  * `nlp_analyzer.py` → GPT analysis pipeline
  * `bias_detector.py` → bias phrase detection
  * `privacy_utils.py` → PHI redaction/tokenization

### 6.3 Database
* PostgreSQL (via Supabase)
* SQLAlchemy ORM

### 6.4 Storage
* Temporary audio in cloud bucket (24h lifecycle)
* Text + metadata stored in Postgres

### 6.5 Third-Party Integrations
* Whisper (speech-to-text)
* GPT-4 / 4-mini (text analysis)
* Stripe (subscriptions)
* SendGrid / Resend (notifications)
* Entrada / One45 (future API integration)

## 7. Non-Functional Requirements
| Category            | Specification                                          |
| :------------------ | :----------------------------------------------------- |
| **Performance**     | ≤60s transcription for ≤5min audio; dashboard <3s load |
| **Scalability**     | ≥1,000 active users/institution                        |
| **Reliability**     | 99.5% uptime; 3× retry for failed API calls            |
| **Security**        | AES-256 + TLS 1.3                                      |
| **Privacy**         | PHI redacted before NLP; audio deleted post-processing |
| **Accessibility**   | WCAG 2.1 AA mobile web compliance                      |
| **Maintainability** | Modular Docker services                                |
| **Compliance**      | HIPAA / PHIPA-aligned data storage                     |

## 8. Analytics Computation Logic
### 8.1 Milestone Score Mapping
| Label             | Value |
| :---------------- | :---- |
| Novice            | 1     |
| Advanced Beginner | 2     |
| Competent         | 3     |
| Proficient        | 4     |
| Expert            | 5     |

### 8.2 EPA Progression
`count(stage) / total_sessions × 100`

### 8.3 Skill Trends
Moving average over 4-week window; visualized per skill dimension.

## 9. Deployment & Environment
* **Frontend:** Vercel / Netlify CI/CD
* **Backend:** Fly.io / Render containers
* **Database:** Supabase (Postgres + auth)
* **Env Vars:** API_KEYS (Whisper, OpenAI, Stripe, Email)
* **Monitoring:** Sentry + Prometheus

## 10. Testing & Validation
* Unit tests for all service modules.
* Mock Whisper/GPT APIs for CI.
* Integration tests (audio → structured feedback).
* QA validation for bias flag accuracy and dashboard correctness.

## 11. Phase 2 Roadmap
* Offline recording + deferred sync
* Institutional integrations (One45, Entrada, MedHub)
* Group analytics + benchmarking
* Explainable AI summaries
* Supervisor review login + queue
* Speaker identification (multi-voice parsing)

## 12. Strategic Advantages
| Category                  | Advantage                                                             |
| :------------------------ | :-------------------------------------------------------------------- |
| **Automation**            | Converts qualitative feedback → structured assessments automatically. |
| **Bias Reduction**        | Flags potentially biased language for review.                         |
| **Resident Empowerment**  | Enables reflection and self-assessment via transcript access.         |
| **Supervisor Efficiency** | Reduces manual paperwork and entry burden.                            |
| **Analytics Depth**       | Adds semantic, temporal, and topic-based insights.                    |
| **Scalability**           | Institution-agnostic; adaptable across programs.                      |

## 13. Key Technical Takeaways
* **Latency target:** ≤60s transcription-to-structured-data.
* **Integration readiness:** JSON export conforming to Entrada schema.
* **Mapping table:** Debrief topic → Entrada EPA_ID.
* **Privacy hooks:** Delete audio upon success; anonymize before LLM.
* **OAuth support:** University SSO and Entrada/One45 integration.

## 14. Open Questions / TBD
* Supervisor role-based access (unlock criteria).
* Institutional hosting policy (on-prem vs cloud).
* Whisper/GPT API quota management.
* Version control for feedback revisions (v2).
  
