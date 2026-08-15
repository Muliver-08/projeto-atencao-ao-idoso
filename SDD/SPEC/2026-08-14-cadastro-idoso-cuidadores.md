# Spec — Cadastro de Idoso e Cuidadores

## Objective
- Monorepo funcional (backend FastAPI+SQLAlchemy 2.0 sync+Alembic, frontend Vite+React+TS+shadcn+React Router+axios) entregando RF01-04 + RF14 + RN01 + RN03, com sessão de cuidador via cookie httpOnly assinado.

## Scope
**In**
- Backend: models, migrations, schemas, services, routers de idoso/cuidador/sessão, testes pytest
- Frontend: telas de idoso/cuidador, seletor de cuidador, integração via axios com cookie de sessão

**Out**
- RN02, RF05-RF13, autenticação com senha, deploy

## Files to Create

### `backend/pyproject.toml`
- Purpose: gerenciar deps via uv
- Contents: deps `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2.0`, `psycopg[binary]`, `alembic`, `itsdangerous`, `pydantic-settings`; dev-deps `pytest`, `httpx`
- Integration points: consumido por `uv sync` / `uv run`

### `backend/app/main.py`
- Purpose: entrypoint FastAPI
- Contents:
  - `app = FastAPI()`
  - `app.add_middleware(CORSMiddleware, allow_origins=[settings.CORS_ORIGIN], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])` — origem explícita (RNF13), nunca `"*"` (incompatível com `allow_credentials=True` e exigido pelo axios `withCredentials`)
  - `app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY, https_only=<True em produção>, same_site="lax")`
  - `app.include_router(idosos.router)`, `app.include_router(cuidadores.router)`, `app.include_router(sessao.router)`
  - `GET /health` → `{"status": "ok"}`
- Notes/Constraints: `SessionMiddleware` é do Starlette (`starlette.middleware.sessions`), assina o cookie com itsdangerous — não expõe payload ao JS, não precisa de tabela de sessão

### `backend/app/config.py`
- Purpose: settings centralizadas
- Contents: `Settings(BaseSettings)` com `DATABASE_URL: str`, `CORS_ORIGIN: str`, `SESSION_SECRET_KEY: str`; `model_config = SettingsConfigDict(env_file=".env")`
- Integration points: importado por `main.py`, `database.py`

### `backend/app/database.py`
- Purpose: engine e sessão de DB síncronos
- Contents:
  ```python
  engine = create_engine(settings.DATABASE_URL)
  SessionLocal = sessionmaker(bind=engine)

  def get_db():
      db = SessionLocal()
      try:
          yield db
      finally:
          db.close()
  ```
- Integration points: `Depends(get_db)` nos routers

### `backend/app/models/base.py`
- Purpose: base declarativa
- Contents: `class Base(DeclarativeBase): pass`

### `backend/app/models/idoso.py`
- Purpose: entidade Idoso
- Contents: `id`, `nome: Mapped[str]`, `idade: Mapped[int]`, `observacoes: Mapped[str | None]`, `criado_em: Mapped[datetime]`, `cuidadores: Mapped[list["Cuidador"]] = relationship(secondary="idoso_cuidador", back_populates="idosos")`

### `backend/app/models/cuidador.py`
- Purpose: entidade Cuidador + tabela de associação
- Contents:
  - `idoso_cuidador = Table("idoso_cuidador", Base.metadata, Column("idoso_id", ForeignKey("idosos.id"), primary_key=True), Column("cuidador_id", ForeignKey("cuidadores.id"), primary_key=True), Column("vinculado_em", DateTime, server_default=func.now()))`
  - `class Cuidador(Base)`: `id`, `nome: Mapped[str]`, `telefone: Mapped[str]`, `idosos: Mapped[list["Idoso"]] = relationship(secondary=idoso_cuidador, back_populates="cuidadores")`
- Notes/Constraints: RN01 — sem `UniqueConstraint` além da PK composta (idoso+cuidador não duplica o vínculo)

### `backend/app/schemas/idoso.py`
- Purpose: validação de entrada/saída
- Contents: `IdosoCreate(nome: str, idade: int, observacoes: str | None = None)`, `IdosoRead(id, nome, idade, observacoes, cuidadores: list[CuidadorRead])`
- Notes/Constraints: validar `nome` não vazio, `idade` > 0 (RNF04)

### `backend/app/schemas/cuidador.py`
- Purpose: validação de entrada/saída
- Contents: `CuidadorCreate(nome: str, telefone: str)`, `CuidadorRead(id, nome, telefone)`
- Notes/Constraints: validar `telefone` não vazio (RNF04)

### `backend/app/services/idoso_service.py`
- Purpose: regra de negócio de idoso
- Contents: `criar_idoso(db, dados: IdosoCreate) -> Idoso`, `listar_idosos(db) -> list[Idoso]`, `obter_idoso(db, id) -> Idoso` (404 se não existe)

### `backend/app/services/cuidador_service.py`
- Purpose: regra de negócio de cuidador e vínculo
- Contents: `criar_cuidador(db, dados: CuidadorCreate) -> Cuidador`, `listar_cuidadores(db)`, `vincular_cuidador(db, idoso_id, cuidador_id) -> None` (idempotente: se já vinculado, não duplica — RN01)

### `backend/app/routers/idosos.py`
- Purpose: endpoints REST de idoso
- Contents:
  - `POST /idosos` → `IdosoRead`, 201
  - `GET /idosos` → `list[IdosoRead]`
  - `GET /idosos/{idoso_id}` → `IdosoRead` (inclui cuidadores vinculados), 404 se não existe
- Notes/Constraints: try/except em torno de operações de DB → `HTTPException(status_code=..., detail="mensagem legível")`, nunca stack trace (RNF03/RNF11)
- Reuse: `Depends(get_db)`, `idoso_service`

### `backend/app/routers/cuidadores.py`
- Purpose: endpoints REST de cuidador e vínculo
- Contents:
  - `POST /cuidadores` → `CuidadorRead`, 201
  - `GET /cuidadores` → `list[CuidadorRead]`
  - `POST /idosos/{idoso_id}/cuidadores/{cuidador_id}` → 204 (vincula)
- Reuse: `Depends(get_db)`, `cuidador_service`

### `backend/app/routers/sessao.py`
- Purpose: seleção do cuidador atual (RF14)
- Contents:
  - `POST /sessao` body `{cuidador_id: int}` → grava `request.session["cuidador_id"] = cuidador_id` (valida que o cuidador existe antes), 204
  - `GET /sessao` → `{cuidador_id: int | None}` lido de `request.session`
- Notes/Constraints: nenhum dado sensível no cookie além do id numérico do cuidador; cookie é `httponly` via `SessionMiddleware` (RNF12)

### `backend/migrations/` (Alembic)
- Purpose: histórico de schema
- Contents: `alembic init migrations`; `env.py` com `target_metadata = Base.metadata` e `sqlalchemy.url` lido de `settings.DATABASE_URL`; primeira revisão autogerada cria `idosos`, `cuidadores`, `idoso_cuidador`
- Integration points: `alembic upgrade head` aplica

### `backend/tests/conftest.py`
- Purpose: fixtures de teste
- Contents: fixture `client` (`TestClient(app)`), fixture `db` apontando para banco de teste (schema recriado por teste ou transação com rollback)

### `backend/tests/test_idosos.py`
- Purpose: cobrir RF01
- Contents: cria idoso com sucesso (201); nome vazio retorna 422; lista idosos criados

### `backend/tests/test_cuidadores.py`
- Purpose: cobrir RF02, RF03
- Contents: cria cuidador; vincula a idoso; idoso retorna cuidador na lista; vínculo duplicado não gera erro nem duplicata (RN01)

### `backend/tests/test_sessao.py`
- Purpose: cobrir RF14
- Contents: `POST /sessao` com cuidador válido retorna 204 e seta cookie; `GET /sessao` retorna o `cuidador_id` correto; cookie na resposta tem flag `HttpOnly`

### `backend/.env.example`
- Purpose: template de variáveis de ambiente
- Contents: `DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/atencao_idoso`, `CORS_ORIGIN=http://localhost:5173`, `SESSION_SECRET_KEY=changeme`

### `frontend/src/lib/api.ts`
- Purpose: cliente HTTP central
- Contents:
  ```ts
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
  });
  export default api;
  ```
- Notes/Constraints: `withCredentials: true` obrigatório pra cookie de sessão cross-origin funcionar (Vercel↔Render)

### `frontend/src/main.tsx`
- Purpose: bootstrap + rotas
- Contents: `createBrowserRouter([{ path: "/", Component: Layout, children: [{ index: true, Component: Home }, { path: "idosos", Component: Idosos }, { path: "cuidadores", Component: Cuidadores }] }])`, `<RouterProvider router={router} />`
- Notes/Constraints: pacote é `react-router` (v7 unificou `react-router-dom` em `react-router`), não instalar `react-router-dom` separado

### `frontend/src/pages/Idosos.tsx`
- Purpose: listar/cadastrar idoso
- Contents: form shadcn (`Form`, `Input`) com `nome`, `idade`, `observacoes`; `Table`/lista de idosos cadastrados; chamada via `api.ts`
- Notes/Constraints: erro de rede → `Alert` shadcn com mensagem legível (RNF05); validação client-side de campos obrigatórios (RNF04)

### `frontend/src/pages/Cuidadores.tsx`
- Purpose: listar/cadastrar cuidador, vincular a idoso
- Contents: form (`nome`, `telefone`); `Select` shadcn pra escolher idoso e vincular; lista de cuidadores

### `frontend/src/components/SeletorCuidador.tsx`
- Purpose: RF14 — seletor de "cuidador atual"
- Contents: `Select` shadcn listando cuidadores; `onValueChange` chama `POST /sessao`; ao montar, chama `GET /sessao` pra restaurar seleção

### `frontend/.env.example`
- Purpose: template de variável de ambiente
- Contents: `VITE_API_URL=http://localhost:8000`

## Implementation Order (recommended)
1. `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/config.py` (Phase 1)
2. Scaffold `frontend/` + shadcn + deps (Phase 1)
3. `backend/app/database.py`, `models/`, Alembic + primeira migration (Phase 2)
4. `backend/app/schemas/`, `services/`, `routers/` (Phase 3)
5. `backend/tests/` (Phase 4)
6. `frontend/src/lib/api.ts`, `main.tsx` (rotas), `pages/`, `components/SeletorCuidador.tsx` (Phase 5)
7. Verificação end-to-end (Phase 6)

## Validation (commands / checks)
- Backend: `uv sync`, `uv run uvicorn app.main:app --reload`, `uv run alembic upgrade head`, `uv run pytest`
- Frontend: `pnpm install`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm dev`

## Notes
- CORS: `allow_origins` deve ser a origem exata do frontend (nunca `"*"`), obrigatório porque `allow_credentials=True` + `withCredentials: true` não funcionam com wildcard.
- Sessão: `SessionMiddleware` (Starlette/itsdangerous) — cookie assinado, `httponly` por padrão, sem tabela de sessão no banco. Trade-off aceito: revogação de sessão não é possível (não crítico pra RF14, que não é autenticação real).
- `react-router` v7: pacote único substitui `react-router-dom`; usar `createBrowserRouter` + `RouterProvider` (padrão "data router").
