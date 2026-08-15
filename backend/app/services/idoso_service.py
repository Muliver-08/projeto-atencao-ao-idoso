from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.idoso import Idoso
from app.schemas.idoso import IdosoCreate


def criar_idoso(
    db: Session, dados: IdosoCreate, criado_por_cuidador_id: int | None
) -> Idoso:
    idoso = Idoso(
        nome=dados.nome,
        data_nascimento=dados.data_nascimento,
        observacoes=dados.observacoes,
        criado_por_cuidador_id=criado_por_cuidador_id,
    )
    db.add(idoso)
    db.commit()
    db.refresh(idoso)
    return idoso


def listar_idosos(db: Session) -> list[Idoso]:
    return list(db.scalars(select(Idoso)).all())


def obter_idoso(db: Session, idoso_id: int) -> Idoso:
    idoso = db.get(Idoso, idoso_id)
    if idoso is None:
        raise HTTPException(status_code=404, detail="Idoso não encontrado")
    return idoso
