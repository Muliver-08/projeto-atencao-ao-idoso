from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cuidador import idoso_cuidador
from app.models.idoso import Idoso
from app.schemas.idoso import IdosoCreate


def criar_idoso(
    db: Session, dados: IdosoCreate, criado_por_cuidador_id: int
) -> Idoso:
    idoso = Idoso(
        nome=dados.nome,
        data_nascimento=dados.data_nascimento,
        observacoes=dados.observacoes,
        criado_por_cuidador_id=criado_por_cuidador_id,
    )
    db.add(idoso)
    db.flush()
    db.execute(
        idoso_cuidador.insert().values(
            idoso_id=idoso.id,
            cuidador_id=criado_por_cuidador_id,
            vinculado_por_cuidador_id=criado_por_cuidador_id,
        )
    )
    db.commit()
    db.refresh(idoso)
    return idoso


def listar_idosos(db: Session, cuidador_id: int) -> list[Idoso]:
    return list(
        db.scalars(
            select(Idoso)
            .join(idoso_cuidador, idoso_cuidador.c.idoso_id == Idoso.id)
            .where(idoso_cuidador.c.cuidador_id == cuidador_id)
        ).all()
    )


def obter_idoso(db: Session, idoso_id: int, cuidador_id: int) -> Idoso:
    idoso = db.get(Idoso, idoso_id)
    if idoso is None or cuidador_id not in {c.id for c in idoso.cuidadores}:
        raise HTTPException(status_code=404, detail="Idoso não encontrado")
    return idoso
