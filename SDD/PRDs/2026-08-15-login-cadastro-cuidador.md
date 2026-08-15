# PRD — Login, Logout e Cadastro com Senha para Cuidador

## 1) Objetivo
- Substituir a identificação atual do cuidador (seletor por nome/id, sem senha) por autenticação real: cadastro com email + senha, login e logout.
- Existe hoje (RF14/RN02 em `base.md`) uma versão simplificada deliberada para o hackathon ("seletor de cuidador, sem senha"). O usuário pediu explicitamente evoluir para login/senha real — este PRD documenta o estado atual como base para a mudança, não como crítica.

## 2) Escopo
**Inclui**
- Campo `email` (único) e `senha_hash` no model `Cuidador`.
- Endpoint de cadastro de cuidador passando a exigir email + senha (além de nome/telefone já existentes).
- Endpoint de login: valida email+senha, cria sessão (cookie, via `SessionMiddleware` já existente).
- Endpoint de logout: destrói a sessão.
- Hashing de senha com bcrypt (nunca texto plano).
- Migration Alembic para as novas colunas.

**Não inclui (fora de escopo)**
- Recuperação de senha / "esqueci minha senha".
- Verificação de email.
- Tokens JWT / refresh tokens — o projeto já usa sessão via cookie (`starlette.middleware.sessions`), este PRD assume que a troca não muda esse mecanismo de transporte, só passa a exigir credenciais para criar a sessão.
- Alterar `GET /cuidadores` (listagem pública de cuidadores) — não fica claro se deve continuar existindo aberta; ver Open Questions.
- Papéis/permissões (admin vs cuidador comum) — não mencionado no pedido.

## 3) Fluxo atual (como funciona hoje)
Hoje não existe autenticação: existe uma "seleção de cuidador".

- `POST /cuidadores` (`backend/app/routers/cuidadores.py:12`) cria um cuidador só com `nome` e `telefone` (`backend/app/schemas/cuidador.py:7`), sem exigir quem está logado.
- `GET /cuidadores` (`backend/app/routers/cuidadores.py:28`) lista **todos** os cuidadores do banco, sem autenticação — usado pelo frontend para popular um dropdown "quem está usando o app agora".
- `POST /sessao` (`backend/app/routers/sessao.py:23`) recebe apenas `{cuidador_id}` e grava direto em `request.session["cuidador_id"]` — **sem verificar senha nenhuma**, qualquer um pode "logar" como qualquer cuidador só sabendo o id.
- `GET /sessao` (`backend/app/routers/sessao.py:40`) retorna o `cuidador_id` da sessão atual.
- `get_cuidador_atual_id` (`backend/app/routers/sessao.py:19`) é a dependency reusada pelos outros routers (`cuidadores.py`, presumivelmente `idosos.py`/`medicamentos.py`/`registros_dose.py`) para saber "quem" fez a ação.
- Não existe endpoint de logout — o frontend não limpa a sessão em lugar nenhum (`frontend/src/lib/cuidador-contexto.tsx` só tem `escolher`/`recarregar`, sem `sair`).
- Frontend: `frontend/src/routes/cuidadores.tsx` cadastra cuidador e explicitamente anuncia na UI "sem senha nem login" (linha 29). `frontend/src/lib/cuidador-contexto.tsx` carrega a lista inteira de cuidadores e deixa escolher um.
- Model `Cuidador` (`backend/app/models/cuidador.py:18`) tem só `id, nome, telefone, criado_em, criado_por_cuidador_id` — **não tem email nem senha**.
- Migrations existentes: `backend/migrations/versions/57c204bc42db_create_idosos_cuidadores_tables.py` (criação original de `cuidadores`/`idosos`) e mais 3 migrations posteriores (nenhuma toca `cuidadores`).

## 4) Fluxo desejado (comportamento esperado)
- Cadastro: cuidador informa nome, telefone, email e senha. Backend valida email único, faz hash da senha (bcrypt) e nunca guarda/retorna a senha em texto plano.
- Login: cuidador informa email + senha. Backend verifica o hash; se ok, cria sessão (mesmo mecanismo de cookie atual). Se inválido, erro genérico (não revelar se foi email ou senha errada).
- Logout: endpoint que limpa a sessão atual.
- `get_cuidador_atual_id` continua sendo a fonte de "quem está agindo", mas agora só é preenchido via login autenticado — não mais por escolha livre de um id em `POST /sessao` sem senha.
- Frontend: o "seletor de cuidador" dá lugar a telas de login/cadastro com campos de email/senha; contexto de cuidador passa a ter `login`, `logout` (hoje só tem `escolher`).

## 5) Mapa do Codebase (onde isso vive)

### 5.1 Entradas (rotas/telas/handlers)
- `backend/app/routers/cuidadores.py` — `POST /cuidadores` (cadastro), `GET /cuidadores` (listagem aberta)
- `backend/app/routers/sessao.py` — `POST /sessao` (seleção sem senha, vira login), `GET /sessao` (estado da sessão); não há rota de logout ainda
- `frontend/src/routes/cuidadores.tsx` — tela de cadastro de cuidador (sem senha) e vínculo a idosos
- `frontend/src/lib/cuidador-contexto.tsx` — `CuidadorProvider`, expõe `escolher`/`recarregar`, sem `login`/`logout`

### 5.2 Domínio / Regras / Serviços
- `backend/app/services/cuidador_service.py` — `criar_cuidador`, `listar_cuidadores`, `vincular_cuidador`; nenhuma lógica de senha/autenticação hoje

### 5.3 Persistência / Modelos / Migrações
- `backend/app/models/cuidador.py:18` — model `Cuidador`, sem `email`/`senha_hash`
- **Migrations**: Alembic (`backend/migrations/versions/`). Adicionar `email` (unique, not null) e `senha_hash` (not null) exige nova migration. Histórico atual: `57c204bc42db` (cria `idosos`/`cuidadores`), `3350335ecce2`, `e09521b3d190`, `fa7d9d632772` — nenhuma altera `cuidadores`.

### 5.4 Integrações externas (clients/adapters/providers)
- Nenhuma hoje relacionada a auth. `backend/pyproject.toml` não tem `bcrypt`/`passlib`/`python-jose` nas dependências — precisa ser adicionada.
- Sessão de cookie já configurada em `backend/app/main.py:18` via `SessionMiddleware(secret_key=settings.SESSION_SECRET_KEY, https_only=False, same_site="lax")`; `SESSION_SECRET_KEY` já existe em `backend/app/config.py:7`.

### 5.5 UI / Componentes (se aplicável)
- `frontend/src/routes/cuidadores.tsx` — formulário atual de cadastro (nome + telefone), precisa de campos email/senha
- `frontend/src/lib/api.ts:129` — objeto `api` centraliza chamadas HTTP (`obterSessao`, `definirSessao`, `criarCuidador`, etc.), é o ponto de reuso para novas chamadas `login`/`logout`
- `frontend/src/lib/tipos.ts:3` — tipo `Cuidador` (`id, nome, telefone`), não tem `email`

### 5.6 Testes / Fixtures (se existirem)
- `backend/tests/test_cuidadores.py` — cobre `POST /cuidadores` e vínculo, cria cuidador só com nome/telefone
- `backend/tests/test_sessao.py` — cobre seleção de cuidador sem senha e cookie httponly; esses testes ficam obsoletos com login real (assumem que só o id basta)
- `backend/tests/conftest.py` — fixture `client`/`db` com banco Postgres de teste isolado por transação (savepoint)

## 6) Padrões existentes para reuso (evitar duplicação)
- `backend/app/routers/sessao.py:19` (`get_cuidador_atual_id`) — dependency já usada nos outros routers para saber o cuidador atual; login deve continuar alimentando essa mesma chave de sessão.
- `backend/app/database.py:12` (`get_db`) — dependency padrão de sessão de banco, usada em todos os routers.
- Padrão de tratamento de erro dos routers (try/except genérico com `HTTPException(500, "mensagem amigável")`, exceto reraise de `HTTPException`) — visto em `cuidadores.py` e presumivelmente replicado nos demais routers; deve ser seguido pelos novos endpoints de login/cadastro (RNF03/RNF11).
- `frontend/src/lib/api.ts` — padrão `chamar(real, exemplo)` com fallback pra modo demo; novas chamadas de login/logout devem seguir o mesmo padrão de encapsulamento e tradução de erro (`traduzir`, `ApiError`).
- `frontend/src/lib/cuidador-contexto.tsx` — contexto React já existente para estado de cuidador atual; ponto natural para adicionar `login`/`logout`.

## 7) Documentação externa (via Context7)

### Consultas realizadas
| Library ID | Query | Resumo do resultado |
|------------|-------|---------------------|
| `/pyca/bcrypt` | "hash password and verify with checkpw, generating salt" | Confirma API `bcrypt.gensalt(rounds=12)` + `bcrypt.hashpw(password_bytes, salt)` para gerar hash, e `bcrypt.checkpw(password_bytes, hashed_bytes)` (constant-time) para verificar. Senha limitada a 72 bytes; TypeError se não for `bytes`. |

### Trechos relevantes
- **bcrypt**: fluxo mínimo de hash e verificação
  ```python
  import bcrypt

  hashed = bcrypt.hashpw(senha.encode(), bcrypt.gensalt(rounds=12))
  ok = bcrypt.checkpw(senha_informada.encode(), hashed)
  ```

## 8) Impactos prováveis (áreas afetadas)
- Backend — model: `Cuidador` ganha `email`, `senha_hash`.
- Backend — migration: nova revisão Alembic para as colunas acima (+ índice/constraint unique em `email`).
- Backend — schemas: `CuidadorCreate` passa a exigir `email`/`senha`; novo(s) schema(s) para login.
- Backend — service: `cuidador_service.criar_cuidador` passa a fazer hash da senha e checar unicidade de email; nova função de autenticação (buscar por email + `checkpw`).
- Backend — router `cuidadores.py`: cadastro passa a exigir email/senha.
- Backend — router `sessao.py`: `POST /sessao` muda de "selecionar por id" para "login por email+senha"; precisa de rota de logout nova.
- Backend — dependências (`pyproject.toml`): adicionar `bcrypt`.
- Frontend — tipo `Cuidador`, formulário de cadastro, contexto de cuidador, e a tela que hoje é "seletor sem senha" (`cuidadores.tsx`) — tudo isso muda de forma para virar telas de login/cadastro.
- Testes — `test_cuidadores.py` e `test_sessao.py` ficam desatualizados frente ao novo contrato (email/senha).

## 9) Critérios de aceitação
- [ ] Um visitante consegue se cadastrar como cuidador informando nome, telefone, email e senha.
- [ ] Duas contas não podem usar o mesmo email.
- [ ] A senha nunca é armazenada nem retornada em texto plano (somente hash).
- [ ] Um cuidador cadastrado consegue logar com email+senha e a sessão passa a identificá-lo nas ações seguintes (criação de idoso, medicamento, confirmação de dose, etc.).
- [ ] Login com email ou senha incorretos retorna erro genérico e compreensível (RNF03), sem revelar qual campo está errado.
- [ ] Existe uma ação de logout que encerra a sessão.
- [ ] Erros de servidor (500) continuam nunca vazando detalhes técnicos ao usuário (RNF03/RNF11).

## 10) Open Questions (bloqueios / dúvidas)
- `GET /cuidadores` hoje lista todos os cuidadores do banco sem autenticação (usado para o dropdown antigo). Com login real, esse endpoint deve deixar de existir, exigir autenticação, ou continuar público? Isso afeta se `frontend/src/lib/cuidador-contexto.tsx` continua carregando "todos os cuidadores" ou passa a depender só da sessão.
- Requisito de força de senha (tamanho mínimo, etc.)? Não especificado pelo usuário.
- O que acontece com cuidadores já existentes no banco (migração de dados), que não têm email/senha? A coluna `email` precisa ser `NOT NULL` — precisa de estratégia para linhas existentes (banco de dev/teste, provavelmente pode ser resetado, mas vale confirmar).
- Rate limiting / bloqueio após tentativas de login falhas — fora de escopo original do hackathon (RNF12 só menciona não vazar dados sensíveis em logs/URL); confirmar se é necessário agora.
- Duração da sessão / expiração de cookie — `SessionMiddleware` atual não define `max_age`; login real deveria ter alguma expiração?
