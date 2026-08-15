# Deploy

Auto-deploy nativo: push na `main` dispara build/deploy no Render e na Vercel direto. GitHub Actions (`.github/workflows/ci.yml`) só roda testes/lint como gate, não deploya nada.

## Backend + banco — Render

1. Dashboard Render → New → Blueprint → conectar este repo. Ele lê `render.yaml` na raiz e cria o Web Service (`atencao-idoso-backend`, build via `backend/Dockerfile`) + o Postgres (`atencao-idoso-db`) juntos.
2. `DATABASE_URL` e `SESSION_SECRET_KEY` são preenchidos automaticamente (blueprint). Falta setar manualmente:
   - `CORS_ORIGIN` = URL pública do frontend na Vercel (ex: `https://seu-app.vercel.app`) — sem barra no final.
3. Healthcheck aponta pra `/health`. Dockerfile já roda `alembic upgrade head` antes de subir o uvicorn.
4. Free plan do Render dorme sem tráfego — primeiro request depois de idle sofre cold start (RNF07 já prevê isso).

## Frontend — Vercel

1. Dashboard Vercel → Add New → Project → importar este repo, **Root Directory = `frontend`**.
2. Framework preset: Vite (auto-detectado). Build command/output ficam no zero-config do TanStack Start, não mexer.
3. Env vars do projeto Vercel:
   - `VITE_API_URL` = URL pública do backend no Render (ex: `https://atencao-idoso-backend.onrender.com`).
   - `NITRO_PRESET` = `vercel` — sem isso o build usa o preset default do lovable config (`cloudflare-module`) e quebra no runtime da Vercel. Confirmado lendo o zero-config em `@lovable.dev/vite-tanstack-config` (respeita `NITRO_PRESET`/`SERVER_PRESET` do env antes do fallback) e a doc do Nitro (`NITRO_PRESET` é a forma recomendada pra CI/CD).
4. Depois do primeiro deploy, volta no Render e ajusta `CORS_ORIGIN` pra URL real gerada pela Vercel.

## Local dev com Docker

```
docker compose up
```

Sobe Postgres 17 (porta 5432) + backend (porta 8000, roda migrations automático no start). Frontend continua rodando fora do Docker (`npm run dev` em `frontend/`, porta 8080 fixa pelo config do Lovable).
