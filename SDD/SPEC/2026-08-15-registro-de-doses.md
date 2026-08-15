# Spec — Registro de Doses

## Objective
- Permitir que um cuidador confirme a administração de uma dose de um medicamento (RF10-13), com bloqueio de dose duplicada por cuidador vinculado (RN13-RN16), indicador de atraso (RN18/RN19) e histórico imutável visível a todos (RF11, RN20).

## Scope
**In**
- Backend: model `RegistroDose`, migration, cálculo de `proximo_horario_previsto`/`atrasado` em `Medicamento`, schemas, service, router, testes pytest
- Frontend: botão de confirmar dose por medicamento, indicador visual de atraso, histórico de doses, modal de observação opcional

**Out**
- RN02, autenticação completa, edição/remoção de registros de dose, fila de doses futuras, lembretes/notificações proativas

## Files to Modify

### `backend/app/models/medicamento.py`
- Changes:
  - Adicionar constante de módulo `TOLERANCIA_ATRASO_MINUTOS = 30`
  - Adicionar função de módulo `calcular_horario_previsto(horario: time, frequencia_horas: int, agora: datetime) -> datetime`:
    ```python
    def calcular_horario_previsto(
        horario: time, frequencia_horas: int, agora: datetime
    ) -> datetime:
        ancora = datetime.combine(agora.date(), horario)
        if ancora > agora:
            ancora -= timedelta(days=1)
        intervalo = timedelta(hours=frequencia_horas)
        passos = (agora - ancora) // intervalo
        return ancora + passos * intervalo
    ```
  - Adicionar à classe `Medicamento`:
    ```python
    @property
    def proximo_horario_previsto(self) -> datetime:
        return calcular_horario_previsto(
            self.horario, self.frequencia_horas, datetime.now()
        )

    @property
    def atrasado(self) -> bool:
        limite = self.proximo_horario_previsto + timedelta(
            minutes=TOLERANCIA_ATRASO_MINUTOS
        )
        return datetime.now() > limite
    ```
  - Import adicional: `timedelta` de `datetime`
- Notes/Constraints: função é pura (recebe `agora` como parâmetro) pra ser testável sem mockar relógio; `calcular_horario_previsto` fica neste módulo (não em `registro_dose_service.py`) pra evitar import circular, já que o service de dose importa `Medicamento`. Nenhuma migration necessária aqui — `proximo_horario_previsto`/`atrasado` são `@property`, não colunas (mesmo padrão de `Idoso.idade`).
- Reuse: mesmo padrão de campo computado de `backend/app/models/idoso.py:29-38`

### `backend/app/schemas/medicamento.py`
- Changes: `MedicamentoRead` ganha dois campos:
  ```python
  proximo_horario_previsto: datetime
  atrasado: bool
  ```
- Notes/Constraints: import `datetime` de `datetime` (junto do `time` já importado)

### `backend/migrations/env.py`
- Changes: `from app.models import idoso, cuidador, medicamento, interacao, registro_dose  # noqa: F401  (...)`

### `backend/app/main.py`
- Changes:
  - `from app.routers import cuidadores, idosos, medicamentos, registros_dose, sessao`
  - `app.include_router(registros_dose.router)`
- Reuse: mesmo padrão dos routers existentes

## Files to Create

### `backend/app/models/registro_dose.py`
- Purpose: entidade de confirmação de dose (RF10, RN14, RN20)
- Contents:
  ```python
  from datetime import datetime

  from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
  from sqlalchemy.orm import Mapped, mapped_column, relationship

  from app.models.base import Base
  from app.models.cuidador import Cuidador


  class RegistroDose(Base):
      __tablename__ = "registros_dose"
      __table_args__ = (
          UniqueConstraint("medicamento_id", "horario_previsto", name="uq_registro_dose_medicamento_horario"),
      )

      id: Mapped[int] = mapped_column(primary_key=True)
      medicamento_id: Mapped[int] = mapped_column(ForeignKey("medicamentos.id"))
      cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
      horario_previsto: Mapped[datetime] = mapped_column(DateTime)
      confirmado_em: Mapped[datetime] = mapped_column(server_default=func.now())
      observacao: Mapped[str | None]

      cuidador: Mapped[Cuidador] = relationship()
  ```
- Notes/Constraints: sem coluna `ativo`/soft delete — RN20 é só-leitura por natureza, não há operação de remoção. `UniqueConstraint(medicamento_id, horario_previsto)` é a garantia de RN15 sob concorrência (duas confirmações simultâneas da mesma dose).

### `backend/app/schemas/registro_dose.py`
- Purpose: shapes de entrada/saída de confirmação de dose
- Contents:
  ```python
  from datetime import datetime

  from pydantic import BaseModel, ConfigDict

  from app.schemas.cuidador import CuidadorRead


  class RegistroDoseCreate(BaseModel):
      observacao: str | None = None


  class RegistroDoseRead(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      id: int
      medicamento_id: int
      horario_previsto: datetime
      confirmado_em: datetime
      observacao: str | None
      cuidador: CuidadorRead
  ```
- Notes/Constraints: `RegistroDoseCreate` não tem campo de horário — o cliente nunca envia `horario_previsto` (decisão da seção 10 do PRD); o backend sempre calcula.

### `backend/app/services/registro_dose_service.py`
- Purpose: regras de negócio de confirmação/histórico de dose (RN13, RN15, RN16, RN18)
- Contents:
  ```python
  from datetime import datetime

  from fastapi import HTTPException
  from sqlalchemy import select
  from sqlalchemy.exc import IntegrityError
  from sqlalchemy.orm import Session

  from app.models.cuidador import idoso_cuidador
  from app.models.medicamento import Medicamento, calcular_horario_previsto
  from app.models.registro_dose import RegistroDose
  from app.schemas.registro_dose import RegistroDoseCreate
  from app.services import medicamento_service


  def _validar_vinculo(db: Session, idoso_id: int, cuidador_id: int) -> None:
      vinculado = db.execute(
          select(idoso_cuidador).where(
              idoso_cuidador.c.idoso_id == idoso_id,
              idoso_cuidador.c.cuidador_id == cuidador_id,
          )
      ).first()
      if vinculado is None:
          raise HTTPException(
              status_code=403, detail="Você não está vinculado a este idoso."
          )


  def _buscar_confirmacao_existente(
      db: Session, medicamento_id: int, horario_previsto: datetime
  ) -> RegistroDose | None:
      return db.scalars(
          select(RegistroDose).where(
              RegistroDose.medicamento_id == medicamento_id,
              RegistroDose.horario_previsto == horario_previsto,
          )
      ).first()


  def _erro_dose_ja_confirmada(existente: RegistroDose) -> HTTPException:
      return HTTPException(
          status_code=409,
          detail={
              "mensagem": f"Esta dose já foi confirmada por {existente.cuidador.nome}.",
              "confirmado_por": existente.cuidador.nome,
              "confirmado_em": existente.confirmado_em.isoformat(),
          },
      )


  def confirmar_dose(
      db: Session,
      medicamento_id: int,
      dados: RegistroDoseCreate,
      cuidador_atual_id: int | None,
  ) -> RegistroDose:
      if cuidador_atual_id is None:
          raise HTTPException(
              status_code=401, detail="Selecione um cuidador para confirmar a dose."
          )

      medicamento = medicamento_service.obter_medicamento(db, medicamento_id)
      _validar_vinculo(db, medicamento.idoso_id, cuidador_atual_id)

      horario_previsto = calcular_horario_previsto(
          medicamento.horario, medicamento.frequencia_horas, datetime.now()
      )

      existente = _buscar_confirmacao_existente(db, medicamento_id, horario_previsto)
      if existente is not None:
          raise _erro_dose_ja_confirmada(existente)

      registro = RegistroDose(
          medicamento_id=medicamento_id,
          cuidador_id=cuidador_atual_id,
          horario_previsto=horario_previsto,
          observacao=dados.observacao,
      )
      db.add(registro)
      try:
          db.commit()
      except IntegrityError:
          db.rollback()
          existente = _buscar_confirmacao_existente(db, medicamento_id, horario_previsto)
          if existente is not None:
              raise _erro_dose_ja_confirmada(existente)
          raise
      db.refresh(registro)
      return registro


  def listar_doses(db: Session, idoso_id: int) -> list[RegistroDose]:
      return list(
          db.scalars(
              select(RegistroDose)
              .join(Medicamento, Medicamento.id == RegistroDose.medicamento_id)
              .where(Medicamento.idoso_id == idoso_id)
              .order_by(RegistroDose.confirmado_em.desc())
          ).all()
      )
  ```
- Notes/Constraints: RN16 (não confirmar dose futura) é garantida por construção — `calcular_horario_previsto` nunca retorna um horário `> agora`, então não há input de horário do cliente pra validar. `IntegrityError` do `try/except` no `commit` é rede de segurança pra concorrência real (dois `POST` simultâneos passando pela checagem em serviço antes do outro commitar); sem esse catch, o segundo `commit` levantaria 500 genérico.
- Reuse: `medicamento_service.obter_medicamento` (404 se medicamento não existe/inativo), `idoso_cuidador` de `app/models/cuidador.py`

### `backend/app/routers/registros_dose.py`
- Purpose: endpoints REST de confirmação e histórico de dose
- Contents:
  - `POST /medicamentos/{medicamento_id}/doses` → `RegistroDoseRead`, 201. `Depends(get_cuidador_atual_id)`, delega tudo a `registro_dose_service.confirmar_dose`
  - `GET /idosos/{idoso_id}/doses` → `list[RegistroDoseRead]`. Valida idoso via `idoso_service.obter_idoso` antes de listar
  - Mesmo padrão de try/except → `HTTPException` das demais rotas (RNF03/RNF11)
- Reuse: `Depends(get_db)`, `Depends(get_cuidador_atual_id)` de `app.routers.sessao`, `idoso_service.obter_idoso`

### `backend/tests/test_registros_dose.py`
- Purpose: cobrir RF10-13, RN13, RN15, RN16
- Contents:
  - Helper `_criar_idoso_cuidador_medicamento_vinculado(client)`: cria idoso, cuidador, vincula, cadastra medicamento, seleciona cuidador via `POST /sessao` — retorna ids
  - Confirmar dose sem cuidador selecionado (sem `POST /sessao` prévio) → 401
  - Confirmar dose com cuidador não vinculado ao idoso → 403
  - Confirmar dose com sucesso → 201, corpo com `cuidador.nome`
  - Confirmar a mesma dose de novo (mesmo medicamento, sem passar tempo) → 409 com `detail.confirmado_por`
  - `GET /idosos/{id}/doses` retorna lista ordenada com a dose confirmada
  - Teste unitário de `calcular_horario_previsto` (import direto de `app.models.medicamento`): horário-âncora no futuro do dia recua 1 dia; múltiplos de `frequencia_horas` avançam corretamente

### `frontend/src/components/ConfirmarDoseDialog.tsx`
- Purpose: modal de confirmação de dose com observação opcional (RF13)
- Contents: props `{ open: boolean; medicamentoNome: string; enviando: boolean; onConfirmar: (observacao: string | null) => void; onCancelar: () => void }`; `useState` local pra `observacao`; usa `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` (já instalado) + `Input` ou `textarea` simples pra observação; título "Confirmar dose de {medicamentoNome}"; botões "Cancelar" e "Confirmar dose"
- Reuse: mesma estrutura de `frontend/src/components/ConfirmarInteracaoDialog.tsx`

## Files to Modify (frontend)

### `frontend/src/pages/IdosoDetalhe.tsx`
- Changes:
  - Interface `Medicamento` ganha `proximo_horario_previsto: string` e `atrasado: boolean`
  - Nova interface `RegistroDose`: `{ id: number; medicamento_id: number; horario_previsto: string; confirmado_em: string; observacao: string | null; cuidador: { id: number; nome: string; telefone: string } }`
  - `carregarDados` passa a buscar também `GET /idosos/{id}/doses` (`Promise.all` com as duas chamadas já existentes) e guardar em `doses` (state novo)
  - Tabela de medicamentos ganha coluna "Próxima dose": horário formatado (`HH:MM`) + badge/texto em `text-destructive` "Atrasado" quando `atrasado === true`; e um botão "Confirmar dose" por linha que abre `ConfirmarDoseDialog`
  - Handler `confirmarDose(medicamentoId, observacao)`: `POST /medicamentos/{id}/doses`, trata 409 mostrando `extrairMensagemErro` (já lida com `detail.mensagem` objeto) num `Alert`; sucesso recarrega `carregarDados()`
  - Novo `Card` "Histórico de doses": `Table` com colunas Medicamento (via `medicamentos.find(m => m.id === dose.medicamento_id)?.nome`), Cuidador (`dose.cuidador.nome`), Horário previsto, Confirmado em, Observação — somente leitura, sem ação de editar/remover (RN20)
- Notes/Constraints: erro de 401/403 (sem cuidador selecionado / não vinculado) também passa por `extrairMensagemErro`, que já trata `detail` string
- Reuse: `extrairMensagemErro`, `formatarHorario`, padrão de `Table`/`Card`/`Alert` já usados na própria página

## Implementation Order (recommended)
1. `backend/app/models/registro_dose.py` + `backend/app/models/medicamento.py` (função/properties) + `backend/migrations/env.py` + migration Alembic (Phase 1-2)
2. `backend/app/schemas/registro_dose.py`, `backend/app/schemas/medicamento.py` (Phase 2)
3. `backend/app/services/registro_dose_service.py`, `backend/app/routers/registros_dose.py`, `backend/app/main.py` (Phase 3)
4. `backend/tests/test_registros_dose.py` (Phase 4)
5. `frontend/src/components/ConfirmarDoseDialog.tsx`, `frontend/src/pages/IdosoDetalhe.tsx` (Phase 5)
6. Verificação end-to-end (Phase 6)

## Validation (commands / checks)
- Backend: `uv run alembic upgrade head`, `uv run uvicorn app.main:app --reload`, `uv run pytest`
- Frontend: `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm dev`

## Notes
- `calcular_horario_previsto` vive em `app/models/medicamento.py` (não em `registro_dose_service.py`) especificamente pra evitar import circular (`registro_dose_service` → `Medicamento`; se a função estivesse no service, `Medicamento.proximo_horario_previsto` teria que importar o service de volta).
- O 401/403 desta feature são os primeiros do projeto a exigir/validar `cuidador_atual_id` — não generalizar esse padrão pras rotas já existentes (idosos/cuidadores/medicamentos seguem permissivas, por decisão explícita já tomada nas features anteriores).
