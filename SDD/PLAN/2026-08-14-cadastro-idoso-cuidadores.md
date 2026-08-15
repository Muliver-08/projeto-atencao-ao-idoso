# Cadastro de Idoso e Cuidadores — Implementation Plan

## Overview
Construir o alicerce do projeto: monorepo com backend FastAPI+SQLAlchemy 2.0 (sync)+Alembic e frontend Vite+React+TS+shadcn/ui+React Router+axios, entregando cadastro de idoso, cadastro de cuidador, vínculo N:N entre eles, e um seletor de "cuidador atual" com sessão via cookie httpOnly assinado (sem localStorage, sem senha). É a base de dados e de rastreabilidade (RN03) da qual todas as próximas features (medicamentos, interação, doses) dependem.

## Scope
### In Scope
- RF01, RF02, RF03, RF04, RF14
- RN01, RN03
- Setup do monorepo (`backend/`, `frontend/`) do zero, com boilerplate mínimo funcional (CORS, sessão, endpoint de teste)
- Testes automatizados básicos (pytest) no backend

### Out of Scope
- RN02 (restringir visualização a cuidadores vinculados) — feature futura
- RF05–RF13 (medicamentos, interação, doses) — próximos ciclos SDD
- Autenticação com senha/login real
- Deploy em Vercel/Render

## Current State (from codebase)
- Repositório sem código-fonte — apenas `planejamento.md` e `SDD/` (workflow docs). Esta é a primeira feature implementada.

## Desired End State
- Rodando localmente: backend em `http://localhost:8000`, frontend em `http://localhost:5173` (ou porta padrão Vite).
- É possível, pela UI: cadastrar idoso → cadastrar cuidador → vincular cuidador ao idoso → selecionar "cuidador atual" (grava cookie de sessão) → ver lista de cuidadores vinculados ao idoso.
- Erros de rede/validação aparecem como mensagem legível na UI (nunca tela branca ou erro cru — RNF03/RNF05).
- `pytest` passa no backend cobrindo os endpoints principais.

## References
- PRD: `SDD/PRDs/2026-08-14-cadastro-idoso-cuidadores.md`
- Spec: `SDD/SPEC/2026-08-14-cadastro-idoso-cuidadores.md`
- Key code references: nenhum (greenfield)
- Decisões fechadas nesta sessão (ver Spec > Notes para detalhe):
  - Monorepo `backend/` + `frontend/`; pnpm (frontend) + uv (backend)
  - DB engine síncrono (psycopg + `Session`); migrations via Alembic
  - Sessão do cuidador: cookie httpOnly assinado stateless (Starlette `SessionMiddleware`), sem localStorage
  - Frontend: React Router (`createBrowserRouter`, pacote `react-router` v7) + axios (`withCredentials: true`)

---

## Phase 1: Scaffold do monorepo
### Tasks
- [x] Criar `backend/` com `uv init`, `pyproject.toml` com deps: `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg[binary]`, `alembic`, `itsdangerous`, `pydantic-settings`, `pytest`, `httpx`
- [x] Criar `backend/app/main.py` com FastAPI app, `CORSMiddleware` (origem via env var), `SessionMiddleware` (secret via env var), endpoint `GET /health` de teste
- [x] Criar `backend/.env.example` (`DATABASE_URL`, `CORS_ORIGIN`, `SESSION_SECRET_KEY`)
- [x] Criar `frontend/` via `pnpm create vite@latest . -- --template react-ts` dentro da pasta
- [x] Rodar `pnpm dlx shadcn@latest init -t vite` no `frontend/`
- [x] Instalar `react-router` e `axios` no frontend (`pnpm add react-router axios`)
- [x] Criar `frontend/.env.example` (`VITE_API_URL`)

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv sync` completa sem erro
- [x] `cd backend && uv run uvicorn app.main:app --reload` sobe e `GET /health` responde 200
- [x] `cd frontend && pnpm install` completa sem erro
- [x] `cd frontend && pnpm exec tsc --noEmit` sem erros de tipo

#### Manual Verification
- [x] Backend acessível em `http://localhost:8000/health` no navegador
- [x] Frontend acessível em `http://localhost:5173` mostrando página padrão do Vite/shadcn

---

## Phase 2: Modelos e migrations
### Tasks
- [x] Criar `backend/app/config.py` (Settings via pydantic-settings) — feito na Phase 1 (main.py já dependia)
- [x] Criar `backend/app/database.py` (engine sync, `SessionLocal`, `get_db()`)
- [x] Criar `backend/app/models/base.py` (`DeclarativeBase`)
- [x] Criar `backend/app/models/idoso.py` e `backend/app/models/cuidador.py`, com tabela de associação `idoso_cuidador`, incluindo campo de auditoria (RN03: quem vinculou/cadastrou, quando)
- [x] Configurar Alembic em `backend/migrations/` (`alembic init migrations`), apontar `target_metadata` para `Base.metadata`, configurar `sqlalchemy.url` a partir do `Settings`
- [x] Gerar primeira revisão: `alembic revision --autogenerate -m "create idosos cuidadores tables"`
- [x] Revisar script gerado (sem DROP/ALTER destrutivo)
- [x] Aplicar: `alembic upgrade head`

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run alembic upgrade head` roda sem erro contra um Postgres local
- [x] `cd backend && uv run alembic check` (ou `alembic revision --autogenerate` novamente) não detecta diffs pendentes após o upgrade

#### Manual Verification
- [x] Tabelas `idosos`, `cuidadores`, `idoso_cuidador` existem no banco local (conferir via `psql` ou client gráfico)

---

## Phase 3: Endpoints e regras de negócio
### Tasks
- [x] Criar `backend/app/schemas/idoso.py`, `backend/app/schemas/cuidador.py` (Pydantic Create/Read)
- [x] Criar `backend/app/services/idoso_service.py`, `backend/app/services/cuidador_service.py` com validações (RN01: idoso pode ter vários cuidadores e vice-versa — sem restrição adicional aqui; RN03: toda escrita registra o cuidador responsável)
- [x] Criar `backend/app/routers/idosos.py`: `POST /idosos`, `GET /idosos`, `GET /idosos/{id}` (inclui lista de cuidadores vinculados)
- [x] Criar `backend/app/routers/cuidadores.py`: `POST /cuidadores`, `GET /cuidadores`, `POST /idosos/{idoso_id}/cuidadores/{cuidador_id}` (vincular)
- [x] Criar `backend/app/routers/sessao.py`: `POST /sessao` (seleciona cuidador atual, grava em `request.session`), `GET /sessao` (lê cuidador atual)
- [x] `include_router` de todos no `main.py`
- [x] Tratamento explícito de exceções (try/except → `HTTPException` com mensagem clara; nunca deixar stack trace vazar — RNF03/RNF11)

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run uvicorn app.main:app --reload` sobe sem erro
- [x] `curl -X POST http://localhost:8000/idosos -d '{...}'` retorna 201 com o idoso criado
- [x] Requisição com payload inválido (ex: nome vazio) retorna 422 com mensagem legível, não 500

#### Manual Verification
- [x] Fluxo completo via `/docs` (Swagger UI): criar idoso → criar cuidador → vincular → selecionar sessão → ler sessão

---

## Phase 4: Testes automatizados (backend)
### Tasks
- [x] Criar `backend/tests/conftest.py` (fixture de `TestClient` + banco de teste)
- [x] Criar `backend/tests/test_idosos.py`: cria idoso, valida campos obrigatórios, lista idosos
- [x] Criar `backend/tests/test_cuidadores.py`: cria cuidador, vincula a idoso, lista cuidadores vinculados
- [x] Criar `backend/tests/test_sessao.py`: seleciona cuidador atual, lê sessão, cookie httpOnly presente na resposta

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run pytest` — todos os testes passam

#### Manual Verification
- Nenhuma (fase cobre apenas testes automatizados)

---

## Phase 5: Frontend — telas e integração
### Tasks
- [ ] Criar `frontend/src/lib/api.ts` — instância axios (`baseURL: import.meta.env.VITE_API_URL`, `withCredentials: true`)
- [ ] Configurar `frontend/src/main.tsx` com `createBrowserRouter` (rotas: `/`, `/idosos`, `/cuidadores`)
- [ ] Instalar componentes shadcn necessários (`form`, `input`, `select`, `card`, `table`, `alert`)
- [ ] Criar `frontend/src/pages/Idosos.tsx` — listar/cadastrar idoso
- [ ] Criar `frontend/src/pages/Cuidadores.tsx` — listar/cadastrar cuidador, vincular a idoso
- [ ] Criar `frontend/src/components/SeletorCuidador.tsx` — chama `POST /sessao` / `GET /sessao`
- [ ] Tratamento de erro de conexão (try/catch no axios, `Alert` do shadcn com mensagem legível, nunca tela branca — RNF05)
- [ ] Validação de formulário (campos obrigatórios, feedback inline — RNF04)

### Success Criteria
#### Automated Verification
- [ ] `cd frontend && pnpm exec tsc --noEmit` sem erros
- [ ] `cd frontend && pnpm build` completa sem erro

#### Manual Verification
- [ ] Com backend rodando: cadastrar idoso, cadastrar cuidador, vincular, selecionar cuidador atual — tudo funcional pela UI
- [ ] Desligar o backend e confirmar que a UI mostra mensagem de erro, não quebra/tela branca
- [ ] Cookie de sessão aparece nas DevTools como `HttpOnly` (não acessível via `document.cookie`)

---

## Phase 6: Verificação end-to-end
### Tasks
- [ ] Rodar backend e frontend simultaneamente em portas diferentes, confirmar CORS funcionando (origem explícita, `Access-Control-Allow-Credentials: true`)
- [ ] Percorrer os critérios de aceitação do PRD (seção 9) um a um

### Success Criteria
#### Automated Verification
- [ ] `cd backend && uv run pytest` — passa
- [ ] `cd frontend && pnpm exec tsc --noEmit && pnpm build` — passa

#### Manual Verification
- [ ] Todos os itens da seção "Critérios de aceitação" do PRD confirmados manualmente

---

## Amendments (pós-aprovação, decididas durante a implementação)
- **Idoso.idade → Idoso.data_nascimento** (RF01): `Idoso` armazena `data_nascimento: date`; `idade` virou `@property` calculada no model e exposta em `IdosoRead.idade` (não persistida). `IdosoCreate.data_nascimento` rejeita datas futuras (422).
- **Cuidador.telefone com validação de formato** (RNF04): `CuidadorCreate.telefone` exige regex `^\(\d{2}\) \d{4,5}-\d{4}$` (celular `(51) 99999-9999` ou fixo `(51) 3333-4444`); qualquer outro formato retorna 422.
- Migration `3350335ecce2` aplica a troca de coluna (`idade` → `data_nascimento`) — tabela estava vazia (só dados de teste) no momento, sem necessidade de backfill.
- Frontend (Phase 5) deve usar input de data (não number) pra `data_nascimento` e máscara/validação de telefone no formato `(xx) xxxxx-xxxx`.

## Testing Notes
- Unit/integration tests: pytest + `TestClient` (backend), cobrindo `idosos`, `cuidadores`, `sessao`
- Frontend: sem testes automatizados nesta feature (não decidido/solicitado) — validação manual conforme Fase 5/6
- Manual steps: 1) subir backend 2) subir frontend 3) percorrer fluxo completo de cadastro+vínculo+seleção de cuidador pela UI

## Migration Notes
- Projeto usa **Alembic** (não Flask-Migrate — stack é FastAPI puro).
- Toda mudança de schema: alterar model em `backend/app/models/*.py` → `alembic revision --autogenerate -m "..."` → revisar script (sem DROP/ALTER destrutivo) → `alembic upgrade head` → commitar model + arquivo de revisão juntos.
- Fase 2 deste plano é a única com migration nesta feature.

## Rollout Notes
- Sem deploy nesta feature (fora de escopo — ver PRD seção 2).
