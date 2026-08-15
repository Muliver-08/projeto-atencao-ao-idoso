from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.engine import Row
from sqlalchemy.orm import Session

from app.models.cuidador import idoso_cuidador
from app.models.historico_vinculo import HistoricoVinculo, TipoEventoVinculo
from app.models.idoso import Idoso


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


def _vinculos_restantes(
    db: Session, idoso_id: int, excluir_cuidador_id: int
) -> list[Row]:
    return list(
        db.execute(
            select(idoso_cuidador)
            .where(
                idoso_cuidador.c.idoso_id == idoso_id,
                idoso_cuidador.c.cuidador_id != excluir_cuidador_id,
            )
            .order_by(idoso_cuidador.c.vinculado_em.asc(), idoso_cuidador.c.cuidador_id.asc())
        ).all()
    )


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

    alvo_vinculado = db.execute(
        select(idoso_cuidador).where(
            idoso_cuidador.c.idoso_id == idoso_id,
            idoso_cuidador.c.cuidador_id == cuidador_alvo_id,
        )
    ).first()
    if alvo_vinculado is None:
        raise HTTPException(
            status_code=404, detail="Cuidador não encontrado neste idoso."
        )

    remanescentes = _vinculos_restantes(db, idoso_id, cuidador_alvo_id)
    eh_dono = cuidador_alvo_id == idoso.criado_por_cuidador_id

    if eh_dono:
        idoso.criado_por_cuidador_id = (
            remanescentes[0].cuidador_id if remanescentes else None
        )
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
