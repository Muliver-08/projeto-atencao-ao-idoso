from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cuidador import Cuidador, idoso_cuidador
from app.models.idoso import Idoso
from app.schemas.cuidador import CuidadorVinculado
from app.schemas.idoso import IdosoCreate, IdosoRead


def criar_idoso(
    db: Session, dados: IdosoCreate, criado_por_cuidador_id: int
) -> IdosoRead:
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
    return _idoso_read(idoso)


def _cuidador_vinculado(cuidador: Cuidador, idoso: Idoso) -> CuidadorVinculado:
    return CuidadorVinculado(
        id=cuidador.id,
        nome=cuidador.nome,
        telefone=cuidador.telefone,
        email=cuidador.email,
        eh_dono=cuidador.id == idoso.criado_por_cuidador_id,
    )


def _idoso_read(idoso: Idoso) -> IdosoRead:
    return IdosoRead(
        id=idoso.id,
        nome=idoso.nome,
        data_nascimento=idoso.data_nascimento,
        idade=idoso.idade,
        observacoes=idoso.observacoes,
        cuidadores=[_cuidador_vinculado(c, idoso) for c in idoso.cuidadores],
    )


def listar_idosos(db: Session, cuidador_id: int) -> list[IdosoRead]:
    idosos = db.scalars(
        select(Idoso)
        .join(idoso_cuidador, idoso_cuidador.c.idoso_id == Idoso.id)
        .where(idoso_cuidador.c.cuidador_id == cuidador_id)
    ).all()
    return [_idoso_read(i) for i in idosos]


def obter_idoso(db: Session, idoso_id: int, cuidador_id: int) -> IdosoRead:
    idoso = db.get(Idoso, idoso_id)
    if idoso is None or cuidador_id not in {c.id for c in idoso.cuidadores}:
        raise HTTPException(status_code=404, detail="Idoso não encontrado")
    return _idoso_read(idoso)
