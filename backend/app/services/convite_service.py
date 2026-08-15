from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.convite_vinculo import ConviteVinculo, StatusConvite
from app.models.cuidador import Cuidador, idoso_cuidador
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


def criar_convite(
    db: Session, idoso_id: int, email: str, solicitado_por_cuidador_id: int
) -> ConviteVinculo:
    if db.get(Idoso, idoso_id) is None:
        raise HTTPException(status_code=404, detail="Idoso não encontrado")
    _validar_vinculo(db, idoso_id, solicitado_por_cuidador_id)

    convidado = db.scalar(select(Cuidador).where(Cuidador.email == email))
    if convidado is None:
        raise HTTPException(
            status_code=404, detail="Não existe cuidador cadastrado com esse email."
        )

    convite_pendente = db.scalar(
        select(ConviteVinculo).where(
            ConviteVinculo.idoso_id == idoso_id,
            ConviteVinculo.cuidador_convidado_id == convidado.id,
            ConviteVinculo.status == StatusConvite.PENDENTE,
        )
    )
    if convite_pendente is not None:
        db.delete(convite_pendente)
        db.flush()

    convite = ConviteVinculo(
        idoso_id=idoso_id,
        cuidador_convidado_id=convidado.id,
        solicitado_por_cuidador_id=solicitado_por_cuidador_id,
    )
    db.add(convite)
    db.commit()
    db.refresh(convite)
    return convite


def listar_convites_pendentes(db: Session, cuidador_id: int) -> list[ConviteVinculo]:
    return list(
        db.scalars(
            select(ConviteVinculo).where(
                ConviteVinculo.cuidador_convidado_id == cuidador_id,
                ConviteVinculo.status == StatusConvite.PENDENTE,
            )
        ).all()
    )


def _buscar_convite_do_cuidador(
    db: Session, convite_id: int, cuidador_id: int
) -> ConviteVinculo:
    convite = db.get(ConviteVinculo, convite_id)
    if convite is None or convite.cuidador_convidado_id != cuidador_id:
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    return convite


def aceitar_convite(db: Session, convite_id: int, cuidador_id: int) -> None:
    convite = _buscar_convite_do_cuidador(db, convite_id, cuidador_id)
    convite.status = StatusConvite.ACEITO
    convite.respondido_em = datetime.now()
    db.execute(
        idoso_cuidador.insert().values(
            idoso_id=convite.idoso_id,
            cuidador_id=cuidador_id,
            vinculado_por_cuidador_id=convite.solicitado_por_cuidador_id,
        )
    )
    db.commit()


def recusar_convite(db: Session, convite_id: int, cuidador_id: int) -> None:
    convite = _buscar_convite_do_cuidador(db, convite_id, cuidador_id)
    convite.status = StatusConvite.RECUSADO
    convite.respondido_em = datetime.now()
    db.commit()
