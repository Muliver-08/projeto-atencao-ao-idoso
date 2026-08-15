# Spec — Cadastro de Medicamentos e Verificação de Interação

## Objective
- Cadastro de medicamento (RF05-07) por idoso, com verificação automática de interação (RF08/RF09, RN07-RN12) contra os medicamentos ativos do mesmo idoso, bloqueio de duplicata (RN05) e soft delete (RN06).

## Scope
**In**
- Backend: models, migrations, schemas, services, router de medicamentos, seed placeholder de interações, testes pytest
- Frontend: rota de detalhe do idoso, lista/form de medicamentos, modal de confirmação de risco alto

**Out**
- RF10-13, RN13-20, RN02, conteúdo real da base de interações, edição da base pela UI

## Files to Create

### `backend/app/models/interacao.py`
- Purpose: base curada de pares de princípio ativo × risco (RN08, RN12)
- Contents:
  ```python
  import enum

  from sqlalchemy import Enum, String
  from sqlalchemy.orm import Mapped, mapped_column

  from app.models.base import Base


  class NivelRisco(str, enum.Enum):
      baixo = "baixo"
      moderado = "moderado"
      alto = "alto"


  class InteracaoMedicamentosa(Base):
      __tablename__ = "interacoes_medicamentosas"

      id: Mapped[int] = mapped_column(primary_key=True)
      principio_ativo_a: Mapped[str] = mapped_column(String, index=True)
      principio_ativo_b: Mapped[str] = mapped_column(String, index=True)
      nivel_risco: Mapped[NivelRisco] = mapped_column(Enum(NivelRisco, name="nivel_risco"))
  ```
- Notes/Constraints: tabela não editável pelo app (RN12) — só via seed script. Par é não-ordenado; a query de verificação precisa checar as duas ordens (a,b) e (b,a).

### `backend/app/models/medicamento.py`
- Purpose: entidade Medicamento
- Contents:
  ```python
  from datetime import datetime, time

  from sqlalchemy import ForeignKey, func
  from sqlalchemy.orm import Mapped, mapped_column

  from app.models.base import Base


  class Medicamento(Base):
      __tablename__ = "medicamentos"

      id: Mapped[int] = mapped_column(primary_key=True)
      idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
      nome: Mapped[str]
      principio_ativo: Mapped[str] = mapped_column(index=True)
      dosagem: Mapped[str]
      horario: Mapped[time]
      frequencia_horas: Mapped[int]
      registro_ms: Mapped[str | None]
      ativo: Mapped[bool] = mapped_column(default=True, server_default="true")
      criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
      criado_por_cuidador_id: Mapped[int | None] = mapped_column(
          ForeignKey("cuidadores.id")
      )
  ```
- Notes/Constraints: RN04 (FK obrigatória a `idosos`), RN06 (`ativo` em vez de DELETE), auditoria RN03 via `criado_por_cuidador_id` (mesmo padrão de `Idoso`/`Cuidador`)

### `backend/app/schemas/interacao.py`
- Purpose: shape de saída da interação encontrada
- Contents:
  ```python
  from pydantic import BaseModel, ConfigDict

  from app.models.interacao import NivelRisco


  class InteracaoRead(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      principio_ativo_a: str
      principio_ativo_b: str
      nivel_risco: NivelRisco
  ```

### `backend/app/schemas/medicamento.py`
- Purpose: validação de entrada/saída de medicamento
- Contents:
  ```python
  from datetime import time

  from pydantic import BaseModel, ConfigDict, Field

  from app.schemas.interacao import InteracaoRead


  class MedicamentoCreate(BaseModel):
      nome: str = Field(min_length=1)
      principio_ativo: str = Field(min_length=1)
      dosagem: str = Field(min_length=1)
      horario: time
      frequencia_horas: int = Field(gt=0, le=24)
      registro_ms: str | None = None
      confirmar_risco_alto: bool = False


  class MedicamentoUpdate(BaseModel):
      nome: str | None = Field(default=None, min_length=1)
      principio_ativo: str | None = Field(default=None, min_length=1)
      dosagem: str | None = Field(default=None, min_length=1)
      horario: time | None = None
      frequencia_horas: int | None = Field(default=None, gt=0, le=24)
      registro_ms: str | None = None


  class MedicamentoRead(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      id: int
      idoso_id: int
      nome: str
      principio_ativo: str
      dosagem: str
      horario: time
      frequencia_horas: int
      registro_ms: str | None
      ativo: bool


  class MedicamentoCriado(BaseModel):
      medicamento: MedicamentoRead
      interacao: InteracaoRead | None
  ```
- Notes/Constraints: `confirmar_risco_alto` é o campo que a UI reenvia como `true` após o cuidador confirmar no modal (RN09). `MedicamentoCriado` é o envelope de resposta do `POST` — carrega o medicamento criado + a interação moderada encontrada (se houve, RN10), pra UI mostrar aviso sem precisar de outra chamada.

### `backend/app/services/interacao_service.py`
- Purpose: verificação de interação (RN07, RN08, RN11)
- Contents:
  ```python
  from dataclasses import dataclass

  from sqlalchemy import and_, or_, select
  from sqlalchemy.orm import Session

  from app.models.interacao import InteracaoMedicamentosa, NivelRisco
  from app.models.medicamento import Medicamento

  _ORDEM_RISCO = {NivelRisco.baixo: 0, NivelRisco.moderado: 1, NivelRisco.alto: 2}


  @dataclass
  class InteracaoEncontrada:
      principio_ativo_a: str
      principio_ativo_b: str
      nivel_risco: NivelRisco


  def verificar_interacao(
      db: Session, idoso_id: int, principio_ativo: str
  ) -> InteracaoEncontrada | None:
      principios_ativos = db.scalars(
          select(Medicamento.principio_ativo).where(
              Medicamento.idoso_id == idoso_id, Medicamento.ativo.is_(True)
          )
      ).all()
      if not principios_ativos:
          return None

      interacoes = db.scalars(
          select(InteracaoMedicamentosa).where(
              or_(
                  and_(
                      InteracaoMedicamentosa.principio_ativo_a == principio_ativo,
                      InteracaoMedicamentosa.principio_ativo_b.in_(principios_ativos),
                  ),
                  and_(
                      InteracaoMedicamentosa.principio_ativo_b == principio_ativo,
                      InteracaoMedicamentosa.principio_ativo_a.in_(principios_ativos),
                  ),
              )
          )
      ).all()
      if not interacoes:
          return None

      mais_grave = max(interacoes, key=lambda i: _ORDEM_RISCO[i.nivel_risco])
      return InteracaoEncontrada(
          principio_ativo_a=mais_grave.principio_ativo_a,
          principio_ativo_b=mais_grave.principio_ativo_b,
          nivel_risco=mais_grave.nivel_risco,
      )
  ```
- Notes/Constraints: compara só contra medicamentos **ativos** do idoso (RN07). RN11: `max` pelo nível de risco decide a interação mais grave quando há múltiplas.

### `backend/app/services/medicamento_service.py`
- Purpose: CRUD + regras de negócio de medicamento (RN04, RN05, RN06)
- Contents: `_verificar_duplicado(db, idoso_id, principio_ativo, dosagem, excluir_id=None)` (levanta 422 se já existe medicamento ativo idêntico), `criar_medicamento(db, idoso_id, dados, criado_por_cuidador_id) -> Medicamento`, `listar_medicamentos(db, idoso_id) -> list[Medicamento]` (só `ativo=True`), `obter_medicamento(db, medicamento_id) -> Medicamento` (404 se não existe ou inativo), `atualizar_medicamento(db, medicamento_id, dados) -> Medicamento` (reroda duplicata se `principio_ativo`/`dosagem` mudam), `inativar_medicamento(db, medicamento_id) -> None` (RN06: `ativo=False`, sem DELETE)
- Reuse: mesmo padrão de `idoso_service.py`/`cuidador_service.py`

### `backend/app/routers/medicamentos.py`
- Purpose: endpoints REST de medicamento
- Contents:
  - `POST /idosos/{idoso_id}/medicamentos` → `MedicamentoCriado`, 201. Fluxo: `idoso_service.obter_idoso` (404 se idoso não existe) → `interacao_service.verificar_interacao` → se `nivel_risco == "alto"` e `not dados.confirmar_risco_alto`, levanta `HTTPException(409, detail={"mensagem": ..., "interacao": InteracaoRead...})` → senão `medicamento_service.criar_medicamento` (422 se duplicado) → retorna `MedicamentoCriado(medicamento=..., interacao=interacao se nivel_risco != "alto" senão None)`
  - `GET /idosos/{idoso_id}/medicamentos` → `list[MedicamentoRead]` (só ativos)
  - `PATCH /medicamentos/{medicamento_id}` → `MedicamentoRead`
  - `DELETE /medicamentos/{medicamento_id}` → 204 (soft delete)
- Notes/Constraints: try/except em torno de operações de DB → `HTTPException` com mensagem legível, nunca stack trace (RNF03/RNF11). O 409 é a **única** rota desta feature que retorna `detail` como objeto (não string) — documentar isso no frontend, pois `extrairMensagemErro` (padrão existente) assume `detail` string.
- Reuse: `Depends(get_db)`, `Depends(get_cuidador_atual_id)` de `app.routers.sessao`, `idoso_service.obter_idoso`

### `backend/scripts/seed_interacoes.py`
- Purpose: popular `interacoes_medicamentosas` com dados placeholder (RN12: base não editável pelo app, só por script/migration de dados)
- Contents:
  ```python
  from app.database import SessionLocal
  from app.models.interacao import InteracaoMedicamentosa, NivelRisco

  # Placeholder fictício — substituir por dados curados reais da equipe antes de qualquer uso real.
  DADOS_PLACEHOLDER = [
      ("principio-teste-a", "principio-teste-b", NivelRisco.alto),
      ("principio-teste-c", "principio-teste-d", NivelRisco.moderado),
      ("principio-teste-e", "principio-teste-f", NivelRisco.baixo),
  ]


  def seed() -> None:
      db = SessionLocal()
      try:
          for principio_a, principio_b, nivel in DADOS_PLACEHOLDER:
              existe = (
                  db.query(InteracaoMedicamentosa)
                  .filter_by(principio_ativo_a=principio_a, principio_ativo_b=principio_b)
                  .first()
              )
              if existe is None:
                  db.add(
                      InteracaoMedicamentosa(
                          principio_ativo_a=principio_a,
                          principio_ativo_b=principio_b,
                          nivel_risco=nivel,
                      )
                  )
          db.commit()
      finally:
          db.close()


  if __name__ == "__main__":
      seed()
  ```
- Integration points: rodar manualmente via `uv run python scripts/seed_interacoes.py` após `alembic upgrade head` — nunca dentro da migration (regra DDL≠DML)

### `backend/migrations/` (Alembic — 2 novas revisões)
- Purpose: schema de `medicamentos` e `interacoes_medicamentosas`
- Contents: `alembic revision --autogenerate -m "create medicamentos table"`; `alembic revision --autogenerate -m "create interacoes_medicamentosas table"` — revisar geração do tipo enum Postgres `nivel_risco` antes de aplicar
- Integration points: `alembic upgrade head` aplica ambas

### `backend/tests/test_medicamentos.py`
- Purpose: cobrir RF05-07, RN04-06
- Contents: cria medicamento com sucesso (201); duplicado (mesmo princípio ativo+dosagem, ativo) retorna 422; `DELETE` some da listagem mas idoso segue existindo; listar retorna só ativos

### `backend/tests/test_interacoes.py`
- Purpose: cobrir RF08-09, RN07-RN11
- Contents: usa fixture `db` pra inserir linhas de teste em `InteracaoMedicamentosa` diretamente; risco alto sem `confirmar_risco_alto` retorna 409 com `interacao` no body; reenviar com `confirmar_risco_alto: true` retorna 201; risco moderado retorna 201 direto com `interacao` preenchido na resposta; múltiplas interações simultâneas retornam a de maior risco no 409/resposta

### `frontend/src/pages/IdosoDetalhe.tsx`
- Purpose: página de detalhe do idoso (rota `/idosos/:id`) — dados do idoso, cuidadores vinculados, lista/form de medicamentos
- Contents: `useParams` pra pegar `id`; `GET /idosos/{id}` (reuso do endpoint existente, já traz `cuidadores`); `GET /idosos/{id}/medicamentos`; form controlado (`useState`, sem `react-hook-form`) com `nome`, `principio_ativo`, `dosagem`, `horario` (texto mascarado `HH:MM`), `frequencia_horas`, `registro_ms` opcional; submit faz `POST /idosos/{id}/medicamentos`; trata 409 abrindo `ConfirmarInteracaoDialog`; trata sucesso com `interacao` não-nulo mostrando `Alert` informativo (RN10); `Table` de medicamentos ativos com botão de remover (`DELETE /medicamentos/{id}`)
- Notes/Constraints: erro de rede/validação → `Alert` shadcn com mensagem legível (RNF05), mesmo padrão de `extrairMensagemErro` de `Idosos.tsx`/`Cuidadores.tsx`, adaptado pra extrair `detail.mensagem` quando `detail` é objeto (caso do 409)

### `frontend/src/components/ConfirmarInteracaoDialog.tsx`
- Purpose: modal de confirmação de risco alto (RN09)
- Contents: props `{ open: boolean; interacao: { principio_ativo_a: string; principio_ativo_b: string; nivel_risco: string } | null; onConfirmar: () => void; onCancelar: () => void }`; usa `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` do shadcn (`dialog`, a instalar); título "Interação de risco alto identificada"; descrição citando os dois princípios ativos; botões "Cancelar" e "Entendo o risco e quero prosseguir"
- Notes/Constraints: se o componente `dialog` não estiver disponível no registry `base-nova` (mesmo problema ocorrido com `form` na feature anterior), substituir por `Alert` (variant `destructive`) inline com os mesmos dois botões, sem instalar dependência nova — decidir na implementação após tentar instalar

### `frontend/src/lib/data.ts` *(opcional — só se úteis)*
- Purpose: helpers de máscara compartilhados, caso `formatarData`/`formatarTelefone` sejam extraídos de `Idosos.tsx`/`Cuidadores.tsx` pra reuso em `formatarHorario`
- Notes/Constraints: **não obrigatório** — se o tempo apertar, duplicar uma função `formatarHorario` pequena direto em `IdosoDetalhe.tsx` (padrão `HH:MM`, mesma lógica de `formatarTelefone`) é aceitável e mais simples; extrair helper compartilhado é só se sobrar tempo

## Files to Modify

### `backend/app/main.py`
- Changes: `app.include_router(medicamentos.router)`
- Reuse: mesmo padrão dos routers existentes

### `frontend/src/main.tsx`
- Changes: adicionar rota `{ path: "idosos/:id", Component: IdosoDetalhe }` dentro do `children` do `Layout`
- Reuse: mesma estrutura de `createBrowserRouter` já existente

### `frontend/src/pages/Idosos.tsx`
- Changes: cada linha de `TableRow` da listagem de idosos vira um `Link` (`react-router`) pra `/idosos/${idoso.id}`, em vez de texto estático
- Reuse: `Link` de `react-router` (já usado em `Layout.tsx`)

## Implementation Order (recommended)
1. `backend/app/models/interacao.py`, `medicamento.py` + migrations + `scripts/seed_interacoes.py` (Phase 1)
2. `backend/app/schemas/`, `services/`, `routers/medicamentos.py`, `main.py` (Phase 2)
3. `backend/tests/test_medicamentos.py`, `test_interacoes.py` (Phase 3)
4. `dialog` (tentar instalar), `ConfirmarInteracaoDialog.tsx`, `IdosoDetalhe.tsx`, `main.tsx`, `Idosos.tsx` (Phase 4)
5. Verificação end-to-end (Phase 5)

## Validation (commands / checks)
- Backend: `uv run alembic upgrade head`, `uv run python scripts/seed_interacoes.py`, `uv run uvicorn app.main:app --reload`, `uv run pytest`
- Frontend: `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm dev`

## Notes
- O 409 estruturado (`detail` como objeto, não string) é uma exceção ao padrão dos endpoints anteriores — necessário porque a UI precisa dos dados da interação pra desenhar o modal, não só de uma mensagem. Documentar isso explicitamente no código (comentário curto no router) pra não confundir futuras features que copiarem o padrão de `HTTPException`.
- Nomes de princípio ativo na base de interação são case-sensitive e comparados por igualdade exata — se a equipe substituir o placeholder por dados reais, garantir consistência de capitalização entre `Medicamento.principio_ativo` (o que o cuidador digita) e `InteracaoMedicamentosa` (a base curada). Fora de escopo resolver normalização (ex: lowercase) nesta feature — registrar como possível ajuste futuro se causar falso-negativo de interação.
