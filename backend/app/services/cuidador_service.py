from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cuidador import Cuidador, idoso_cuidador
from app.models.idoso import Idoso
from app.schemas.cuidador import CuidadorCreate


def criar_cuidador(
    db: Session, dados: CuidadorCreate, criado_por_cuidador_id: int | None
) -> Cuidador:
    cuidador = Cuidador(
        nome=dados.nome,
        telefone=dados.telefone,
        criado_por_cuidador_id=criado_por_cuidador_id,
    )
    db.add(cuidador)
    db.commit()
    db.refresh(cuidador)
    return cuidador


def listar_cuidadores(db: Session) -> list[Cuidador]:
    return list(db.scalars(select(Cuidador)).all())


def vincular_cuidador(
    db: Session,
    idoso_id: int,
    cuidador_id: int,
    vinculado_por_cuidador_id: int | None,
) -> None:
    if db.get(Idoso, idoso_id) is None:
        raise HTTPException(status_code=404, detail="Idoso não encontrado")
    if db.get(Cuidador, cuidador_id) is None:
        raise HTTPException(status_code=404, detail="Cuidador não encontrado")

    ja_vinculado = db.execute(
        select(idoso_cuidador).where(
            idoso_cuidador.c.idoso_id == idoso_id,
            idoso_cuidador.c.cuidador_id == cuidador_id,
        )
    ).first()
    if ja_vinculado is not None:
        return

    db.execute(
        idoso_cuidador.insert().values(
            idoso_id=idoso_id,
            cuidador_id=cuidador_id,
            vinculado_por_cuidador_id=vinculado_por_cuidador_id,
        )
    )
    db.commit()
