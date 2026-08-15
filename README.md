# Atenção ao Idoso

App de acompanhamento de medicação para idosos, feito para o **Hackathon IFRS Campus Feliz** (14–15/08/2026). Diário de medicação **compartilhado entre vários cuidadores** do mesmo idoso, com **checagem automática de interação medicamentosa** (base curada interna, sem API externa) e **bloqueio de dose duplicada** (se um cuidador já confirmou a dose, outros são bloqueados e veem quem/quando).

Contexto completo (requisitos funcionais, não-funcionais e regras de negócio) fica em `SDD/planejamento.md` e nos PRDs de cada feature em `SDD/PRDs/`.

## Stack

**Backend** (`backend/`) — Python + FastAPI + SQLAlchemy 2.0 + Alembic, PostgreSQL. Deploy no Render como Web Service contínuo (não serverless).

Camadas: `routers/` (HTTP, try/except → `HTTPException`) → `services/` (regra de negócio) → `models/` (SQLAlchemy).

**Frontend** (`frontend/`) — React 19 + TanStack Start (SSR, roteamento por arquivo) + Tailwind CSS v4 + Radix UI (shadcn-style), npm. Servidor dev fixo na porta 8080.

Frontend e backend são deployados separado, comunicação via HTTP (`VITE_API_URL` / `CORS_ORIGIN`).

## Rodando local

### Backend
```
cd backend
uv sync              # ou pip install -e .
uvicorn app.main:app --reload
```
Precisa de `.env` com `DATABASE_URL`, `CORS_ORIGIN`, `SESSION_SECRET_KEY`.

### Frontend
```
cd frontend
npm install
npm run dev
```

## Funcionalidades principais

- Cadastro de idoso + vínculo com múltiplos cuidadores (convite)
- Cadastro de medicamento por idoso, com verificação automática de interação de risco contra os medicamentos ativos do mesmo idoso
- Interação de risco alto exige confirmação explícita do cuidador antes de salvar; risco moderado é só informativo
- Remoção de medicamento é soft delete (histórico nunca é apagado)
- Registro de dose tomada, com bloqueio se outro cuidador já confirmou a mesma dose
- Histórico de doses (view-only, imutável)

## Fluxo de trabalho (SDD)

O repo segue Spec Driven Development em 3 fases, guiadas por prompts em `SDD/`:

1. `SDD/busca.md` — pesquisa no codebase → gera `PRD.md` (`SDD/PRDs/`)
2. `SDD/planejamento.md` — workshop → gera `plan.md` + `Spec.md` (`SDD/PLAN/`, `SDD/SPEC/`)
3. `SDD/implementar.md` — executa o plan/spec aprovados, fase por fase

Detalhes de convenção e regras de negócio não-negociáveis: ver `CLAUDE.md`.
