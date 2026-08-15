# Login, Cadastro e Convite de Vínculo do Cuidador — Implementation Plan

## Overview
Substitui o "seletor de cuidador sem senha" atual por autenticação real (cadastro com nome/telefone/email/senha, login, logout, sessão expirando em 24h) e troca o vínculo direto idoso↔cuidador por um fluxo de convite por email com aceite/recusa. A partir daqui, visibilidade de idoso passa a respeitar RN02 (só cuidador vinculado vê o idoso) de fato, e toda ação continua registrando o cuidador autor (RN03).

## Scope
### In Scope
- Model `Cuidador`: `email` (unique, not null), `senha_hash` (not null)
- Hash de senha com `bcrypt` (`gensalt`/`hashpw`/`checkpw`)
- Endpoints: `POST /cuidadores` (cadastro, exige email+senha), `POST /sessao/login`, `POST /sessao/logout`, `GET /sessao` (mantém)
- `GET /cuidadores` passa a exigir sessão ativa (401 se deslogado)
- `GET /idosos` e `GET /idosos/{id}` filtrados pelo vínculo do cuidador logado
- Nova entidade `ConviteVinculo` (pendente/aceito/recusado) + endpoints de criar/listar/aceitar/recusar convite
- Sessão expira em 24h (`SessionMiddleware(max_age=86400)`)
- Frontend: telas `/login`, `/cadastro`, lista de convites/notificações, guard de rota redirecionando deslogado para `/login`, `cuidadores.tsx` reduzida a gestão de idosos vinculados + convites
- Dados legados de `cuidadores`/`idoso_cuidador` são apagados na migration (sem estratégia de migração de dados)

### Out of Scope
- Recuperação de senha, verificação de email, envio de email real (convite é só notificação in-app)
- JWT/refresh tokens (mantém sessão via cookie já existente)
- Rate limiting de login
- Papéis/permissões (admin vs cuidador comum)
- Validação de "nome completo" (campo `nome` continua só `min_length=1`, sem mudança)

## Current State (from codebase)
- `backend/app/models/cuidador.py:18` — `Cuidador` sem `email`/`senha_hash`
- `backend/app/routers/sessao.py:23` — `POST /sessao` seleciona cuidador só por id, sem senha
- `backend/app/routers/cuidadores.py:28` — `GET /cuidadores` lista todos, sem auth
- `backend/app/routers/idosos.py:28` — `listar_idosos`/`obter_idoso` sem filtro de vínculo
- `backend/app/services/cuidador_service.py:28` — `vincular_cuidador` vincula direto, sem etapa de convite
- `backend/app/main.py:18` — `SessionMiddleware` sem `max_age`
- `backend/pyproject.toml` — sem dependência `bcrypt`
- `frontend/src/routes/cuidadores.tsx` — mistura cadastro sem senha + vínculo direto
- `frontend/src/lib/cuidador-contexto.tsx` — só `escolher`/`recarregar`, sem `login`/`logout`

## Desired End State
- Um cuidador se cadastra com nome, telefone, email e senha; faz login; a sessão dura 24h; consegue sair (logout).
- Um cuidador logado só vê os idosos aos quais está vinculado.
- Ao cadastrar um idoso, o cuidador pode convidar outro cuidador (por email de conta já existente) para o idoso; o convidado vê o convite numa lista de notificações e aceita ou recusa; convite duplicado substitui o anterior; recusado fica registrado.

## References
- PRD: `SDD/PRDs/2026-08-15-login-cadastro-cuidador.md`
- Spec: `SDD/SPEC/2026-08-15-login-cadastro-cuidador.md`
- Key code references:
  - `backend/app/routers/sessao.py:19` — `get_cuidador_atual_id`, dependency reusada em todo o backend
  - `backend/app/database.py:12` — `get_db`
  - `frontend/src/lib/api.ts:129` — objeto `api`, padrão `chamar(real, exemplo)`

---

## Phase 1: Backend — Model, hashing e migration de cuidador
### Tasks
- [x] Adicionar `email: Mapped[str]` (unique, not null) e `senha_hash: Mapped[str]` (not null) em `backend/app/models/cuidador.py`
- [x] Adicionar dependência `bcrypt` em `backend/pyproject.toml`
- [x] Apagar dados de `cuidadores`/`idoso_cuidador` (dev/test) antes de aplicar `NOT NULL`
- [x] Gerar migration Alembic, revisar script gerado, aplicar (`alembic upgrade head`)

### Success Criteria
#### Automated Verification
- [x] `alembic upgrade head` roda sem erro
- [x] `pytest backend/tests` (suíte completa ainda compila, mesmo que alguns testes antigos quebrem — serão corrigidos na Fase 2/3)

#### Manual Verification
- [x] Colunas `email`/`senha_hash` existem na tabela `cuidadores` (confirmado via inspeção SQLAlchemy)

---

## Phase 2: Backend — Cadastro com email/senha
### Tasks
- [x] `CuidadorCreate` (`backend/app/schemas/cuidador.py`) ganha `email: EmailStr`, `senha: str = Field(min_length=8)`
- [x] `CuidadorRead` ganha `email: str` (nunca expõe `senha`/`senha_hash`)
- [x] `cuidador_service.criar_cuidador` faz hash bcrypt da senha e verifica email duplicado (409 com mensagem amigável)
- [x] Atualizar `backend/tests/test_cuidadores.py` para o novo contrato (email/senha obrigatórios, teste de email duplicado)

### Success Criteria
#### Automated Verification
- [x] `pytest backend/tests/test_cuidadores.py`

#### Manual Verification
- [x] `POST /cuidadores` com email já existente retorna erro compreensível (RNF03) — coberto por `test_criar_cuidador_email_duplicado_retorna_409`

---

## Phase 3: Backend — Login, logout e expiração de sessão
### Tasks
- [x] `cuidador_service.autenticar_cuidador(db, email, senha) -> Cuidador | None` (busca por email, `bcrypt.checkpw`)
- [x] `POST /sessao/login` (`backend/app/routers/sessao.py`): body `email`+`senha`, 401 com mensagem genérica se inválido, senão seta `request.session["cuidador_id"]`
- [x] `POST /sessao/logout`: `request.session.clear()`, 204
- [x] `SessionMiddleware(..., max_age=86400)` em `backend/app/main.py`
- [x] `GET /cuidadores` exige `cuidador_atual_id` não nulo (401 se deslogado)
- [x] Atualizar `backend/tests/test_sessao.py` para o novo contrato (login por email/senha, logout, 401 sem sessão)

### Success Criteria
#### Automated Verification
- [x] `pytest backend/tests/test_sessao.py`
- [x] `pytest backend/tests/test_cuidadores.py`

#### Manual Verification
- [x] Login com senha errada não revela se o problema foi email ou senha — mesma mensagem/401 usada tanto pra email inexistente quanto senha errada (`test_login_com_senha_incorreta_retorna_401`, `test_login_com_email_inexistente_retorna_401`)
- [x] Cookie de sessão expira 24h depois do login — `max_age=86400` configurado no `SessionMiddleware`

---

## Phase 4: Backend — Visibilidade de idoso por vínculo
### Tasks
- [x] `idoso_service.listar_idosos(db, cuidador_id)` filtra pelos idosos vinculados ao cuidador atual
- [x] `idoso_service.obter_idoso(db, idoso_id, cuidador_id)` retorna 404 se o idoso existe mas o cuidador não está vinculado (não revela existência a quem não tem acesso)
- [x] `backend/app/routers/idosos.py` passa `cuidador_atual_id` (via `get_cuidador_atual_id`) para os services acima; 401 se deslogado
- [x] Atualizar `backend/tests/test_idosos.py` para cobrir filtro por vínculo

### Success Criteria
#### Automated Verification
- [x] `pytest backend/tests/test_idosos.py`

#### Manual Verification
- [x] Cuidador A não vê idoso vinculado só ao Cuidador B — coberto por `test_obter_idoso_nao_vinculado_retorna_404` e `test_listar_idosos_retorna_so_os_vinculados_ao_cuidador_logado`

### Desvio registrado (não previsto na Spec)
`idoso_service.obter_idoso` também é chamado por `backend/app/routers/medicamentos.py` (2x) e `backend/app/routers/registros_dose.py` (1x), que não constavam em "Files to Modify" da Spec. Mudar a assinatura pra exigir `cuidador_id` quebraria esses endpoints; ajustados minimamente (mesmo padrão 401 + repasse de `cuidador_atual_id`) pra manter a app funcional.

---

## Phase 5: Backend — Convite de vínculo (model + endpoints)
### Tasks
- [x] Criar `backend/app/models/convite_vinculo.py`: tabela `convites_vinculo` (`id, idoso_id, cuidador_convidado_id, solicitado_por_cuidador_id, status` enum `pendente|aceito|recusado`, `criado_em`, `respondido_em`)
- [x] Migration Alembic para `convites_vinculo`
- [x] `backend/app/schemas/convite_vinculo.py`: `ConviteCreate` (`email: EmailStr`), `ConviteRead`
- [x] `backend/app/services/convite_service.py` (criar/listar/aceitar/recusar convite)
- [x] `backend/app/routers/convites.py`: `POST /idosos/{id}/convites`, `GET /convites`, `POST /convites/{id}/aceitar`, `POST /convites/{id}/recusar`
- [x] Remover `POST /idosos/{idoso_id}/cuidadores/{cuidador_id}` (vínculo direto) em `backend/app/routers/cuidadores.py` e `cuidador_service.vincular_cuidador`
- [x] Registrar `convites.router` em `backend/app/main.py`
- [x] Novo `backend/tests/test_convites.py`: criar convite, convite duplicado substitui, aceitar cria vínculo, recusar não cria vínculo, email inexistente falha

### Success Criteria
#### Automated Verification
- [x] `pytest backend/tests/test_convites.py`
- [x] `pytest backend/tests` (suíte completa — 33 passed)

#### Manual Verification
- [x] Fluxo completo: Cuidador A cadastra idoso → convida Cuidador B por email → Cuidador B vê o convite → aceita → idoso aparece pra ambos — coberto por `test_aceitar_convite_cria_vinculo`

### Desvios registrados (não previstos na Spec)
- `test_medicamentos.py`, `test_interacoes.py` e `test_registros_dose.py` não estavam em "Files to Modify/Create" da Spec, mas quebravam por dependerem do fluxo antigo (cadastro sem senha, `POST /sessao {cuidador_id}`, vínculo direto). Ajustados minimamente pra usar cadastro+login.
- `criar_idoso` (Phase 4) passou a vincular automaticamente o cuidador criador ao idoso em `idoso_cuidador` — já estava anotado como necessário nas Notes da Spec.

---

## Phase 6: Frontend — Login, cadastro e guard de rota
### Tasks
- [x] `frontend/src/lib/tipos.ts`: `Cuidador` ganha `email`
- [x] `frontend/src/lib/api.ts`: `login(email, senha)`, `logout()`, `criarCuidador` inclui `email`/`senha`
- [x] `frontend/src/lib/cuidador-contexto.tsx`: `login`/`logout` substituem `escolher`; contexto guarda cuidador autenticado
- [x] Novo `frontend/src/routes/login.tsx`: formulário email+senha
- [x] Novo `frontend/src/routes/cadastro.tsx`: formulário nome+telefone+email+senha
- [x] Guard de rota no `frontend/src/routes/__root.tsx`: sem sessão válida, redireciona para `/login`
- [x] `frontend/src/routes/cuidadores.tsx` removida; substituída por `frontend/src/routes/convites.tsx`

### Success Criteria
#### Automated Verification
- [x] `npm run build`, `npx tsc --noEmit`, `npm run lint` — todos limpos (só warnings pré-existentes de fast-refresh)

#### Manual Verification
- [ ] Cadastro → login → navegação autenticada → logout → redirecionado a `/login` funciona ponta a ponta no navegador

---

## Phase 7: Frontend — Convites/notificações
### Tasks
- [x] Chamadas de API para convite em `frontend/src/lib/api.ts` (`criarConvite`, `listarConvites`, `aceitarConvite`, `recusarConvite`)
- [x] `frontend/src/routes/convites.tsx`: lista de notificações de convites pendentes (aceitar/recusar)
- [x] Fluxo de convidar cuidador por email na aba "Cuidadores" de `frontend/src/routes/idosos.$id.tsx`

### Success Criteria
#### Automated Verification
- [x] Build do frontend sem erros de tipo

#### Manual Verification
- [ ] Convite aparece na lista do cuidador convidado e some/atualiza após aceitar ou recusar

### Desvios registrados (não previstos na Spec)
- `frontend/src/components/app-shell.tsx` não estava em "Files to Modify" da Spec, mas continha o `SeletorCuidador` (dropdown "quem está usando") — substituído por nome do cuidador logado + botão Sair, e o item de nav "Cuidadores" virou "Convites" apontando pra `/convites`. Necessário pra remover a UI do fluxo antigo.
- Texto do alerta em `AbaMedicamentos` ("Escolha quem está usando o app") atualizado pra refletir login em vez de seleção.

---

## Testing Notes
- Unit/integration tests: `pytest backend/tests` (usa banco Postgres de teste isolado por transação, `backend/tests/conftest.py`)
- Manual steps: 1) cadastrar dois cuidadores 2) logar com o primeiro 3) cadastrar idoso 4) convidar o segundo cuidador pelo email dele 5) logar com o segundo, ver o convite, aceitar 6) confirmar que ambos veem o idoso e nenhum outro cuidador vê

## Migration Notes
- Projeto usa **Alembic puro** (`backend/alembic.ini`, sem wrapper Flask — o texto sobre `flask db migrate` no template do SDD é resquício de outro stack, confirmado nesta feature).
- Padrão a seguir:
  1. Alterar model em `backend/app/models/*.py`
  2. `alembic revision --autogenerate -m "descricao"` — gera script em `backend/migrations/versions/`
  3. Revisar o script gerado (sem DROP/ALTER destrutivo além do combinado: limpeza de dados legados de `cuidadores`/`idoso_cuidador` é intencional e deve constar explicitamente no script/PR)
  4. `alembic upgrade head` — aplica localmente
  5. Commitar model + arquivo `versions/*.py` juntos

## Rollout Notes
- Ambiente de dev/teste: dados atuais de `cuidadores`/`idoso_cuidador` serão perdidos (decisão explícita do usuário) — não há dados de produção a preservar até o momento deste plan.
