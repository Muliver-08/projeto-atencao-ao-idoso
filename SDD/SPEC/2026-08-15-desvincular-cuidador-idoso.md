SPEC PATH: SDD/SPEC/2026-08-15-desvincular-cuidador-idoso.md

# Spec — Desvincular Cuidador de Idoso

## Objective
- Cuidador comum se autodesvincula de um idoso; cuidador dono (`Idoso.criado_por_cuidador_id`) também desvincula outros; toda desvinculação vira evento imutável em `historico_vinculo`, exibido junto do histórico de doses.

## Scope
**In**
- Backend: modelo/migration `historico_vinculo`, `eh_dono` calculado em `IdosoRead.cuidadores`, serviço de desvinculação + transferência de posse, endpoints `DELETE`/`GET`, testes.
- Frontend: ações "Sair"/"Remover" na aba Cuidadores, timeline de histórico mesclada.

**Out**
- Reatribuição manual de posse, mudanças no fluxo de convite, notificações, desfazer.

## Files to Modify

### `backend/app/schemas/cuidador.py`
- Changes:
  - Adicionar `class CuidadorVinculado(CuidadorRead): eh_dono: bool`
- Notes/Constraints:
  - `CuidadorRead` continua igual (usado em `Dose.cuidador`, `Convite.solicitado_por`, etc. — não precisa de `eh_dono` nesses contextos)
- Reuse:
  - Herda de `CuidadorRead` existente

### `backend/app/schemas/idoso.py`
- Changes:
  - Importar `CuidadorVinculado` em vez de `CuidadorRead`
  - `IdosoRead.cuidadores: list[CuidadorVinculado]`
- Notes/Constraints:
  - Não expor `criado_por_cuidador_id` cru no schema (decisão do workshop)

### `backend/app/services/idoso_service.py`
- Changes:
  - Nova função privada `_cuidador_vinculado(cuidador: Cuidador, idoso: Idoso) -> CuidadorVinculado` que monta `CuidadorVinculado(id=..., nome=..., telefone=..., email=..., eh_dono=(cuidador.id == idoso.criado_por_cuidador_id))`
  - Nova função privada `_idoso_read(idoso: Idoso) -> IdosoRead` que monta `IdosoRead` com `cuidadores=[_cuidador_vinculado(c, idoso) for c in idoso.cuidadores]`
  - `obter_idoso` passa a retornar `_idoso_read(idoso)` (tipo de retorno muda para `IdosoRead`)
  - `listar_idosos` passa a retornar `[_idoso_read(i) for i in ...]` (tipo de retorno muda para `list[IdosoRead]`)
- Notes/Constraints:
  - `criar_idoso` continua retornando o ORM `Idoso` (response_model `IdosoRead` do router já converte via `from_attributes`; ok porque nesse ponto `cuidadores` só tem o próprio criador, que é o dono — a conversão automática funcionaria, mas por consistência de tipo pode-se aplicar `_idoso_read` também; não obrigatório)
- Reuse:
  - Import de `Cuidador`/`Idoso` já existentes no arquivo

### `backend/app/routers/idosos.py`
- Changes:
  - Import `Response` de `fastapi`, `vinculo_service` de `app.services`
  - Novo endpoint:
    ```python
    @router.delete("/{idoso_id}/cuidadores/{cuidador_id}", status_code=204)
    def desvincular_cuidador(
        idoso_id: int,
        cuidador_id: int,
        db: Session = Depends(get_db),
        cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
    ) -> Response:
        if cuidador_atual_id is None:
            raise HTTPException(status_code=401, detail="É preciso estar logado.")
        try:
            vinculo_service.desvincular_cuidador(db, idoso_id, cuidador_id, cuidador_atual_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=500, detail="Não foi possível desvincular o cuidador."
            )
        return Response(status_code=204)
    ```
  - Novo endpoint:
    ```python
    @router.get("/{idoso_id}/historico-vinculo", response_model=list[HistoricoVinculoRead])
    def listar_historico_vinculo(
        idoso_id: int,
        db: Session = Depends(get_db),
        cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
    ) -> list[HistoricoVinculoRead]:
        if cuidador_atual_id is None:
            raise HTTPException(status_code=401, detail="É preciso estar logado.")
        try:
            idoso_service.obter_idoso(db, idoso_id, cuidador_atual_id)
            return vinculo_service.listar_historico_vinculo(db, idoso_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=500, detail="Não foi possível listar o histórico de vínculo."
            )
    ```
- Notes/Constraints:
  - Import `HistoricoVinculoRead` de `app.schemas.historico_vinculo`
  - `idoso_service.obter_idoso` chamado antes garante 404 se `cuidador_atual_id` não vinculado (mesmo padrão de `registros_dose.py:35-51`)
- Reuse:
  - `Depends(get_db)`, `Depends(get_cuidador_atual_id)`, padrão try/except já usado nas demais rotas do arquivo

### `backend/migrations/env.py`
- Changes:
  - Linha 10: adicionar `historico_vinculo` à lista de imports: `from app.models import idoso, cuidador, medicamento, interacao, registro_dose, convite_vinculo, historico_vinculo  # noqa: F401`

### `backend/tests/conftest.py`
- Changes:
  - Linha 13: adicionar `historico_vinculo` à lista de imports: `from app.models import cuidador, idoso, convite_vinculo, historico_vinculo  # noqa: F401`

## Files to Create

### `backend/app/models/historico_vinculo.py`
- Purpose:
  - Registro imutável de eventos de entrada/saída de cuidador de um idoso
- Contents:
  ```python
  from datetime import datetime
  from enum import Enum as PyEnum

  from sqlalchemy import Enum, ForeignKey, func
  from sqlalchemy.orm import Mapped, mapped_column, relationship

  from app.models.base import Base
  from app.models.cuidador import Cuidador


  class TipoEventoVinculo(str, PyEnum):
      SAIU = "saiu"
      REMOVIDO = "removido"


  class HistoricoVinculo(Base):
      __tablename__ = "historico_vinculo"

      id: Mapped[int] = mapped_column(primary_key=True)
      idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
      cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
      tipo_evento: Mapped[TipoEventoVinculo] = mapped_column(
          Enum(TipoEventoVinculo, name="tipo_evento_vinculo")
      )
      realizado_por_cuidador_id: Mapped[int | None] = mapped_column(
          ForeignKey("cuidadores.id")
      )
      criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

      cuidador: Mapped[Cuidador] = relationship(foreign_keys=[cuidador_id])
      realizado_por: Mapped[Cuidador | None] = relationship(
          foreign_keys=[realizado_por_cuidador_id]
      )
  ```
- Integration points:
  - Importado por `vinculo_service.py`, `migrations/env.py`, `tests/conftest.py`

### `backend/app/schemas/historico_vinculo.py`
- Purpose:
  - Serialização de eventos de vínculo para a API
- Contents:
  ```python
  from datetime import datetime

  from pydantic import BaseModel, ConfigDict

  from app.models.historico_vinculo import TipoEventoVinculo
  from app.schemas.cuidador import CuidadorRead


  class HistoricoVinculoRead(BaseModel):
      model_config = ConfigDict(from_attributes=True)

      id: int
      idoso_id: int
      cuidador: CuidadorRead
      tipo_evento: TipoEventoVinculo
      realizado_por: CuidadorRead | None
      criado_em: datetime
  ```
- Integration points:
  - Usado como `response_model` de `GET /idosos/{idoso_id}/historico-vinculo`

### `backend/app/services/vinculo_service.py`
- Purpose:
  - Regra de negócio de desvinculação: quem pode, transferência de posse, bloqueio de idoso sem cuidador, registro de histórico
- Contents:
  ```python
  from sqlalchemy import select
  from fastapi import HTTPException
  from sqlalchemy.orm import Session

  from app.models.cuidador import idoso_cuidador
  from app.models.historico_vinculo import HistoricoVinculo, TipoEventoVinculo
  from app.models.idoso import Idoso

  def _validar_vinculo(db: Session, idoso_id: int, cuidador_id: int) -> None:
      # idêntico ao padrão de convite_service._validar_vinculo / registro_dose_service._validar_vinculo

  def _vinculos_restantes(db: Session, idoso_id: int, excluir_cuidador_id: int) -> list:
      # SELECT idoso_cuidador WHERE idoso_id=idoso_id AND cuidador_id != excluir_cuidador_id
      # ORDER BY vinculado_em ASC, cuidador_id ASC

  def desvincular_cuidador(
      db: Session, idoso_id: int, cuidador_alvo_id: int, cuidador_atual_id: int
  ) -> None:
      idoso = db.get(Idoso, idoso_id)
      if idoso is None:
          raise HTTPException(status_code=404, detail="Idoso não encontrado")

      _validar_vinculo(db, idoso_id, cuidador_atual_id)

      eh_auto = cuidador_alvo_id == cuidador_atual_id
      if not eh_auto and cuidador_atual_id != idoso.criado_por_cuidador_id:
          raise HTTPException(
              status_code=403,
              detail="Só o cuidador que cadastrou o idoso pode remover outros cuidadores.",
          )

      _validar_vinculo(db, idoso_id, cuidador_alvo_id)  # 403 -> reaproveitar mensagem, mas aqui é 404 se alvo não vinculado (ajustar mensagem/status na implementação)

      remanescentes = _vinculos_restantes(db, idoso_id, cuidador_alvo_id)
      eh_dono = cuidador_alvo_id == idoso.criado_por_cuidador_id

      if eh_dono:
          idoso.criado_por_cuidador_id = remanescentes[0].cuidador_id if remanescentes else None
      elif eh_auto and not remanescentes:
          raise HTTPException(
              status_code=409,
              detail="Não é possível sair: você é o único cuidador vinculado a este idoso.",
          )

      db.execute(
          idoso_cuidador.delete().where(
              idoso_cuidador.c.idoso_id == idoso_id,
              idoso_cuidador.c.cuidador_id == cuidador_alvo_id,
          )
      )
      db.add(
          HistoricoVinculo(
              idoso_id=idoso_id,
              cuidador_id=cuidador_alvo_id,
              tipo_evento=TipoEventoVinculo.SAIU if eh_auto else TipoEventoVinculo.REMOVIDO,
              realizado_por_cuidador_id=None if eh_auto else cuidador_atual_id,
          )
      )
      db.commit()

  def listar_historico_vinculo(db: Session, idoso_id: int) -> list[HistoricoVinculo]:
      return list(
          db.scalars(
              select(HistoricoVinculo)
              .where(HistoricoVinculo.idoso_id == idoso_id)
              .order_by(HistoricoVinculo.criado_em.desc())
          ).all()
      )
  ```
- Integration points:
  - Consumido por `backend/app/routers/idosos.py` (novos endpoints)
- Notes/Constraints:
  - **Importante**: checar "cuidador alvo vinculado?" deve retornar **404** ("Cuidador não encontrado neste idoso"), não reaproveitar `_validar_vinculo` (que retorna 403) sem ajuste — implementar checagem própria pra esse caso ou parametrizar `_validar_vinculo` com o status/mensagem certos.
  - `_vinculos_restantes` deve excluir o próprio `cuidador_alvo_id` da query, já ordenado por `vinculado_em ASC, cuidador_id ASC` (decisão do workshop) — `remanescentes[0]` é direto o novo dono.
  - Ordem das validações importa: existência do idoso → vínculo do ator → permissão (dono vs. self) → vínculo do alvo → cálculo de remanescentes → bloqueio de "último cuidador" (só se não-dono) → mutação.

## Implementation Order (recommended)
1. `backend/app/models/historico_vinculo.py` + `backend/migrations/env.py` + `backend/tests/conftest.py` (registro de metadata)
2. Migration Alembic (`alembic revision --autogenerate` + revisão + `alembic upgrade head`)
3. `backend/app/schemas/cuidador.py`, `backend/app/schemas/idoso.py`, `backend/app/schemas/historico_vinculo.py`
4. `backend/app/services/idoso_service.py` (`_cuidador_vinculado`, `_idoso_read`, ajuste de `obter_idoso`/`listar_idosos`)
5. `backend/app/services/vinculo_service.py`
6. `backend/app/routers/idosos.py` (dois novos endpoints)
7. `backend/tests/test_vinculo.py`
8. Frontend: `tipos.ts` → `api.ts` → `dados-exemplo.ts` → `historico.tsx` → `idosos.$id.tsx`

## Validation (commands / checks)
- Backend: `uv run alembic upgrade head`, `uv run pytest`, `uv run uvicorn app.main:app --reload` (verificação manual via `/docs`)
- Frontend: `npm run lint`, `npm run build`, `npm run dev` (verificação manual no navegador)

## Notes
- Nenhuma integração externa envolvida.
- `IdosoRead.cuidadores` mudar de `list[CuidadorRead]` para `list[CuidadorVinculado]` é uma mudança de schema de resposta — todo consumidor existente que já lê `idoso.cuidadores.{id,nome,telefone,email}` continua funcionando (campos aditivos), só ganha `eh_dono` a mais.
- `_validar_vinculo` já existe duplicada em `convite_service.py` e `registro_dose_service.py`; esta spec cria uma terceira cópia em `vinculo_service.py` seguindo o padrão atual do repo (sem introduzir um módulo compartilhado novo — fora de escopo desta feature).
