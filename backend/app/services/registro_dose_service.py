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
