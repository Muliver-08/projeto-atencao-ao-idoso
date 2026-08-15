# Spec — Login, Cadastro e Convite de Vínculo do Cuidador

## Objective
- Autenticação real de cuidador (cadastro nome/telefone/email/senha com hash bcrypt, login, logout, sessão de 24h).
- Visibilidade de idoso restrita a cuidadores vinculados.
- Vínculo idoso↔cuidador via convite por email (pendente/aceito/recusado), substituindo o vínculo direto atual.

## Scope
**In**
- Model/migration `Cuidador` (email, senha_hash)
- Model/migration `ConviteVinculo`
- Endpoints: cadastro, login, logout, listar/obter idoso filtrado, convites (criar/listar/aceitar/recusar)
- Frontend: `/login`, `/cadastro`, guard de rota, lista de convites

**Out**
- Recuperação de senha, verificação de email, envio de email real
- JWT/refresh tokens, rate limiting, papéis/permissões
- Validação de "nome completo" (campo `nome` inalterado)

## Files to Modify

### `backend/pyproject.toml`
- Changes:
  - Adicionar `"bcrypt"` em `dependencies`
- Notes/Constraints:
  - Sem pin de versão específica salvo se `uv lock` exigir

### `backend/app/models/cuidador.py`
- Changes:
  - Adicionar `email: Mapped[str] = mapped_column(unique=True, index=True)`
  - Adicionar `senha_hash: Mapped[str]`
- Notes/Constraints:
  - Não expor `senha_hash` em nenhum schema de leitura

### `backend/app/schemas/cuidador.py`
- Changes:
  - `CuidadorCreate`: adicionar `email: EmailStr`, `senha: str = Field(min_length=8)`
  - `CuidadorRead`: adicionar `email: str`
  - Novo schema `CuidadorLogin(BaseModel)`: `email: EmailStr`, `senha: str`
- Notes/Constraints:
  - Requer `pydantic[email]` (`EmailStr`) — checar se já instalado como extra de `pydantic`; se não, adicionar `email-validator` a `pyproject.toml`
- Reuse:
  - Segue padrão de `Field(...)` já usado em `TELEFONE_PATTERN`

### `backend/app/services/cuidador_service.py`
- Changes:
  - `criar_cuidador`: antes de criar, checar `db.scalar(select(Cuidador).where(Cuidador.email == dados.email))`; se existir, `raise HTTPException(409, "Este email já está cadastrado.")`; gerar `senha_hash = bcrypt.hashpw(dados.senha.encode(), bcrypt.gensalt(rounds=12)).decode()`
  - Nova função `autenticar_cuidador(db: Session, email: str, senha: str) -> Cuidador | None`: busca por email; se não achar ou `bcrypt.checkpw(senha.encode(), cuidador.senha_hash.encode())` for `False`, retorna `None`
  - Remover `vincular_cuidador` (substituída pelo fluxo de convite em `convite_service.py`)
- Notes/Constraints:
  - Mensagem de erro de login deve ser genérica ("Email ou senha incorretos.") — não usar a mensagem de 409 do cadastro para diferenciar
- Reuse:
  - Segue padrão existente de `db.add`/`db.commit`/`db.refresh`

### `backend/app/routers/cuidadores.py`
- Changes:
  - `criar_cuidador`: tratar `HTTPException` (409 de email duplicado) sem reescrever a mensagem
  - `listar_cuidadores`: adicionar `cuidador_atual_id: int | None = Depends(get_cuidador_atual_id)`; se `None`, `raise HTTPException(401, "É preciso estar logado.")`
  - Remover rota `POST /idosos/{idoso_id}/cuidadores/{cuidador_id}`
- Notes/Constraints:
  - Manter padrão try/except existente (RNF11)

### `backend/app/routers/sessao.py`
- Changes:
  - Remover `SessaoCreate`/rota atual `POST /sessao` (seleção por id)
  - Adicionar `CuidadorLogin` import de `app.schemas.cuidador`
  - `POST /sessao/login`: recebe `CuidadorLogin`, chama `cuidador_service.autenticar_cuidador`; se `None`, `HTTPException(401, "Email ou senha incorretos.")`; senão `request.session["cuidador_id"] = cuidador.id`, retorna 204
  - `POST /sessao/logout`: `request.session.clear()`, retorna 204
  - `GET /sessao`: mantém como está
  - `get_cuidador_atual_id`: mantém como está (reusada em todo o backend)
- Notes/Constraints:
  - Continua expondo `get_cuidador_atual_id` para os demais routers importarem

### `backend/app/models/idoso.py`
- Changes:
  - Nenhuma mudança de schema; sem alteração estrutural nesta fase

### `backend/app/services/idoso_service.py`
- Changes:
  - `listar_idosos(db: Session, cuidador_id: int) -> list[Idoso]`: `select(Idoso).join(idoso_cuidador).where(idoso_cuidador.c.cuidador_id == cuidador_id)`
  - `obter_idoso(db: Session, idoso_id: int, cuidador_id: int) -> Idoso`: buscar idoso; se `None` **ou** `cuidador_id not in [c.id for c in idoso.cuidadores]`, `raise HTTPException(404, "Idoso não encontrado")` (mesma mensagem nos dois casos, não revela existência)
- Notes/Constraints:
  - `criar_idoso` já recebe `criado_por_cuidador_id`; não precisa mudar, mas o cuidador criador deve ficar automaticamente vinculado ao idoso (ver Files to Create — garantir insert em `idoso_cuidador` no `criar_idoso`, senão o criador não veria o próprio cadastro)

### `backend/app/routers/idosos.py`
- Changes:
  - `criar_idoso`: se `cuidador_atual_id is None`, `HTTPException(401, "É preciso estar logado.")`
  - `listar_idosos`: adicionar `cuidador_atual_id: int | None = Depends(get_cuidador_atual_id)`, 401 se `None`, passar pra `idoso_service.listar_idosos(db, cuidador_atual_id)`
  - `obter_idoso`: adicionar `cuidador_atual_id: int | None = Depends(get_cuidador_atual_id)`, 401 se `None`, passar pra `idoso_service.obter_idoso(db, idoso_id, cuidador_atual_id)`
- Notes/Constraints:
  - Segue padrão try/except existente

### `backend/app/main.py`
- Changes:
  - `SessionMiddleware(secret_key=settings.SESSION_SECRET_KEY, https_only=False, same_site="lax", max_age=86400)`
  - Importar e `app.include_router(convites.router)`
- Reuse:
  - Mantém `CORSMiddleware` como está

### `frontend/src/lib/tipos.ts`
- Changes:
  - `Cuidador` ganha `email: string`
  - Novo tipo `Convite { id: number; idoso: { id: number; nome: string }; solicitado_por: Cuidador; status: "pendente" | "aceito" | "recusado"; criado_em: string }`

### `frontend/src/lib/api.ts`
- Changes:
  - Remover `definirSessao`; adicionar `login: (email: string, senha: string) => chamar<void>(...)` (`POST /sessao/login`), `logout: () => chamar<void>(...)` (`POST /sessao/logout`)
  - `criarCuidador(dados: { nome, telefone, email, senha })`
  - Remover `vincularCuidador`
  - Adicionar `criarConvite(idosoId: number, email: string)`, `listarConvites()`, `aceitarConvite(id: number)`, `recusarConvite(id: number)`
- Notes/Constraints:
  - Seguir padrão `chamar(real, exemplo)` existente; modo demo (`demo.*`) precisa de stubs equivalentes em `frontend/src/lib/dados-exemplo.ts` se quiser manter fallback — **confirmar com o time se o modo demo precisa cobrir login/convites ou pode ficar só pros dados já existentes**

### `frontend/src/lib/cuidador-contexto.tsx`
- Changes:
  - Remover `escolher`; adicionar `login(email, senha)`, `logout()`
  - `recarregar` deixa de chamar `listarCuidadores()` (que agora é lista global protegida, não faz sentido pro contexto); usa só `obterSessao()` + dados do cuidador atual retornados pelo login/sessão

### `frontend/src/routes/__root.tsx`
- Changes:
  - Adicionar guard: checar sessão via contexto/`beforeLoad`; se deslogado e rota não é `/login`/`/cadastro`, redirecionar para `/login`
- Notes/Constraints:
  - TanStack Start usa `beforeLoad` por rota ou lógica no root component — usar o mecanismo idiomático do TanStack Router (checar padrão já usado no projeto antes de implementar)

### `frontend/src/routes/cuidadores.tsx`
- Changes:
  - Remover formulário de cadastro sem senha e texto "sem senha nem login"
  - Remover seção de "Vincular cuidador a um idoso" (vira convite, tela própria ou dentro da tela do idoso)
  - Página passa a listar idosos vinculados ao cuidador logado + acesso à lista de convites

## Files to Create

### `backend/migrations/versions/xxxx_add_email_senha_hash_cuidadores.py`
- Purpose:
  - Adicionar `email`/`senha_hash` a `cuidadores`, apagar dados legados
- Contents:
  - `op.execute("DELETE FROM idoso_cuidador")`, `op.execute("DELETE FROM cuidadores")` (limpa antes de aplicar NOT NULL)
  - `op.add_column("cuidadores", sa.Column("email", sa.String(), nullable=False))`
  - `op.add_column("cuidadores", sa.Column("senha_hash", sa.String(), nullable=False))`
  - `op.create_unique_constraint("uq_cuidadores_email", "cuidadores", ["email"])`
- Integration points:
  - Gerada via `alembic revision --autogenerate`, editada manualmente pra incluir os `DELETE` (autogenerate não gera DML)

### `backend/app/models/convite_vinculo.py`
- Purpose:
  - Persistir convites de vínculo idoso↔cuidador
- Contents:
  ```python
  from datetime import datetime
  from enum import Enum as PyEnum

  from sqlalchemy import DateTime, Enum, ForeignKey, func
  from sqlalchemy.orm import Mapped, mapped_column

  from app.models.base import Base


  class StatusConvite(str, PyEnum):
      PENDENTE = "pendente"
      ACEITO = "aceito"
      RECUSADO = "recusado"


  class ConviteVinculo(Base):
      __tablename__ = "convites_vinculo"

      id: Mapped[int] = mapped_column(primary_key=True)
      idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
      cuidador_convidado_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
      solicitado_por_cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
      status: Mapped[StatusConvite] = mapped_column(
          Enum(StatusConvite, name="status_convite"), default=StatusConvite.PENDENTE
      )
      criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
      respondido_em: Mapped[datetime | None]
  ```
- Integration points:
  - Migration própria (`alembic revision --autogenerate`)

### `backend/app/schemas/convite_vinculo.py`
- Purpose:
  - Schemas de entrada/saída de convite
- Contents:
  ```python
  from datetime import datetime

  from pydantic import BaseModel, ConfigDict, EmailStr

  from app.models.convite_vinculo import StatusConvite
  from app.schemas.cuidador import CuidadorRead


  class ConviteCreate(BaseModel):
      email: EmailStr


  class ConviteRead(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      id: int
      idoso_id: int
      solicitado_por: CuidadorRead
      status: StatusConvite
      criado_em: datetime
  ```
- Integration points:
  - `solicitado_por` requer que o service popule a relação (ou query com join)

### `backend/app/services/convite_service.py`
- Purpose:
  - Regras de negócio do convite
- Contents:
  - `criar_convite(db, idoso_id, email, solicitado_por_cuidador_id) -> ConviteVinculo`:
    - Valida `solicitado_por_cuidador_id` está vinculado ao `idoso_id` (senão 403/404)
    - Busca `Cuidador` por `email`; se não achar, `HTTPException(404, "Não existe cuidador cadastrado com esse email.")`
    - Se já existir convite `pendente` pro mesmo par `(idoso_id, cuidador_convidado_id)`, substituir (delete + insert, ou update dos campos) — nunca duplicar
    - Cria com `status=PENDENTE`
  - `listar_convites_pendentes(db, cuidador_id) -> list[ConviteVinculo]`
  - `aceitar_convite(db, convite_id, cuidador_id) -> None`: valida `convite.cuidador_convidado_id == cuidador_id` (senão 404), `status = ACEITO`, `respondido_em = now()`, insere em `idoso_cuidador`
  - `recusar_convite(db, convite_id, cuidador_id) -> None`: mesma validação, `status = RECUSADO`, `respondido_em = now()`
- Integration points:
  - Reusa `idoso_cuidador` (tabela de associação já existente em `app.models.cuidador`)

### `backend/app/routers/convites.py`
- Purpose:
  - Expor endpoints REST de convite
- Contents:
  ```python
  from fastapi import APIRouter, Depends, HTTPException
  from sqlalchemy.orm import Session

  from app.database import get_db
  from app.routers.sessao import get_cuidador_atual_id
  from app.schemas.convite_vinculo import ConviteCreate, ConviteRead
  from app.services import convite_service

  router = APIRouter(tags=["convites"])


  @router.post("/idosos/{idoso_id}/convites", response_model=ConviteRead, status_code=201)
  def criar_convite(
      idoso_id: int,
      dados: ConviteCreate,
      db: Session = Depends(get_db),
      cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
  ) -> ConviteRead:
      if cuidador_atual_id is None:
          raise HTTPException(status_code=401, detail="É preciso estar logado.")
      try:
          return convite_service.criar_convite(db, idoso_id, dados.email, cuidador_atual_id)
      except HTTPException:
          raise
      except Exception:
          raise HTTPException(status_code=500, detail="Não foi possível criar o convite.")


  @router.get("/convites", response_model=list[ConviteRead])
  def listar_convites(
      db: Session = Depends(get_db),
      cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
  ) -> list[ConviteRead]:
      if cuidador_atual_id is None:
          raise HTTPException(status_code=401, detail="É preciso estar logado.")
      try:
          return convite_service.listar_convites_pendentes(db, cuidador_atual_id)
      except HTTPException:
          raise
      except Exception:
          raise HTTPException(status_code=500, detail="Não foi possível listar os convites.")


  @router.post("/convites/{convite_id}/aceitar", status_code=204)
  def aceitar_convite(
      convite_id: int,
      db: Session = Depends(get_db),
      cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
  ) -> None:
      if cuidador_atual_id is None:
          raise HTTPException(status_code=401, detail="É preciso estar logado.")
      try:
          convite_service.aceitar_convite(db, convite_id, cuidador_atual_id)
      except HTTPException:
          raise
      except Exception:
          raise HTTPException(status_code=500, detail="Não foi possível aceitar o convite.")


  @router.post("/convites/{convite_id}/recusar", status_code=204)
  def recusar_convite(
      convite_id: int,
      db: Session = Depends(get_db),
      cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
  ) -> None:
      if cuidador_atual_id is None:
          raise HTTPException(status_code=401, detail="É preciso estar logado.")
      try:
          convite_service.recusar_convite(db, convite_id, cuidador_atual_id)
      except HTTPException:
          raise
      except Exception:
          raise HTTPException(status_code=500, detail="Não foi possível recusar o convite.")
  ```
- Integration points:
  - Registrado em `backend/app/main.py`

### `backend/migrations/versions/xxxx_create_convites_vinculo_table.py`
- Purpose:
  - Criar tabela `convites_vinculo`
- Contents:
  - Gerado via `alembic revision --autogenerate -m "create convites_vinculo table"` a partir do model acima
- Integration points:
  - Depende da migration da Phase 1 (rodar em sequência)

### `frontend/src/routes/login.tsx`
- Purpose:
  - Tela de login
- Contents:
  - Form com email + senha, chama `api.login`, em sucesso redireciona pra rota inicial
- Integration points:
  - Usa `useCuidador()` (novo `login`) do contexto

### `frontend/src/routes/cadastro.tsx`
- Purpose:
  - Tela de cadastro de cuidador
- Contents:
  - Form com nome, telefone, email, senha (reusa `mascararTelefone`/`telefoneValido` de `frontend/src/lib/formato.ts`), chama `api.criarCuidador`, depois `api.login`
- Integration points:
  - Reusa componentes `Input`/`Label`/`Button`/`Card` já existentes em `frontend/src/components/ui/`

### Tela/lista de convites (arquivo a definir: `frontend/src/routes/convites.tsx` ou componente dentro de `cuidadores.tsx`)
- Purpose:
  - Notificações in-app de convites pendentes
- Contents:
  - Lista `api.listarConvites()`, botões aceitar/recusar chamando `api.aceitarConvite`/`api.recusarConvite`
- Integration points:
  - Reusa `Carregando`/`Vazio`/`AvisoErro` de `frontend/src/components/estados.tsx`

## Backend tests to update/create
- `backend/tests/test_cuidadores.py` — cadastro exige email/senha; teste de email duplicado (409); `GET /cuidadores` exige sessão
- `backend/tests/test_sessao.py` — login com email/senha correto/incorreto; logout limpa sessão; cookie com `max_age`
- `backend/tests/test_idosos.py` — `listar_idosos`/`obter_idoso` filtrados por vínculo; 401 sem sessão; 404 pra idoso não vinculado
- `backend/tests/test_convites.py` (novo) — criar convite (sucesso, email inexistente, idoso não vinculado ao solicitante), convite duplicado substitui o anterior, aceitar cria vínculo em `idoso_cuidador`, recusar não cria vínculo e marca `status=recusado`

## Implementation Order (recommended)
1. Phase 1 (model + migration cuidador) — pré-requisito de tudo
2. Phase 2 (cadastro com senha)
3. Phase 3 (login/logout/expiração)
4. Phase 4 (visibilidade de idoso por vínculo)
5. Phase 5 (convite de vínculo, backend completo)
6. Phase 6 (frontend login/cadastro/guard)
7. Phase 7 (frontend convites)

## Validation (commands / checks)
- `alembic upgrade head` (dentro de `backend/`, com `DATABASE_URL` configurada)
- `pytest backend/tests` (usa banco de teste isolado, ver `backend/tests/conftest.py`)
- Build/typecheck do frontend — comando real do `frontend/package.json` (confirmar antes de rodar; não inventar)

## Notes
- `criar_idoso` deve vincular automaticamente o cuidador criador ao idoso em `idoso_cuidador` (senão ele mesmo ficaria sem acesso ao próprio cadastro) — isso é implícito no fluxo desejado do PRD e deve ser implementado na Phase 4/5, mesmo não estando listado como uma linha separada nas Tasks do Plan.
- Mensagens de erro devem seguir RNF03 (sem jargão, sem stack trace) em todos os novos endpoints.
