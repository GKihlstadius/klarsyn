# Klarsyn

AI-analys för svenska företag. En AI-konsult intervjuar kunden om affären, processerna, systemen och målen, och genererar en rapport med AI Readiness Score, flaskhalsar, ROI-uppskattning, rekommenderade verktyg och en 90-dagars handlingsplan.

Live: https://klarsyn.vercel.app

## Stack

- **Frontend:** React 19 + Vite, ren CSS, `motion` för animationer
- **Backend:** Express (ESM) som en Vercel serverless-funktion (`api/index.js`), SSE-streaming för intervjun
- **Databas:** Supabase Postgres via `@supabase/supabase-js` (secret key, RLS på)
- **LLM:** bytbart lager (`server/llm.js`): Anthropic SDK eller OpenAI-kompatibel endpoint (Groq/Gemini) via env

## Köra lokalt

```
npm install
cp .env.example .env   # fyll i nycklar
npm run server         # backend pa :3001
npm run dev            # frontend pa :5173 (proxy /api -> 3001)
```

## Miljövariabler

Se `.env.example`. Viktigast:

| Variabel | Beskrivning |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Supabase-projektets URL och secret-nyckel (Settings > API keys) |
| `LLM_PROVIDER` | `anthropic` eller `openai-compatible` |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` | för Groq m.fl. |
| `INTERVIEW_MODEL` / `REPORT_MODEL` | modell-id per uppgift |
| `ADMIN_USER` / `ADMIN_PASS` / `ADMIN_TOKEN` | login-grind (demo) |

## Deploy

Vercel bygger automatiskt fran `main` (frontend + serverless-API i samma projekt). Env-vars satts i Vercel-projektet. Databastabellerna skapas via `supabase/migrations/` (SQL Editor eller `supabase db push`).

## Struktur

```
api/index.js          Vercel-funktion (exporterar Express-appen)
server/app.js         Alla API-rutter
server/interview.js   Intervjumotorn (stateful, fyra delar)
server/report.js      Rapportgenerering (scoring, ROI, roadmap)
server/llm.js         LLM-lager (streaming + JSON)
server/db.js          Datalager (supabase-js)
src/                  React-app (landning, login, intervju, rapport, admin)
```
