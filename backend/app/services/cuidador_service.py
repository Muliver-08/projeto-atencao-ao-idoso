import bcrypt
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.cuidador import Cuidador
from app.schemas.cuidador import CuidadorCreate

def _erro_email_duplicado() -> HTTPException:
    return HTTPException(status_code=409, detail="Este email já está cadastrado.")


def criar_cuidador(
    db: Session, dados: CuidadorCreate, criado_por_cuidador_id: int | None
) -> Cuidador:
    email_existente = db.scalar(select(Cuidador).where(Cuidador.email == dados.email))
    if email_existente is not None:
        raise _erro_email_duplicado()

    senha_hash = bcrypt.hashpw(dados.senha.encode(), bcrypt.gensalt(rounds=12)).decode()
    cuidador = Cuidador(
        nome=dados.nome,
        telefone=dados.telefone,
        email=dados.email,
        senha_hash=senha_hash,
        criado_por_cuidador_id=criado_por_cuidador_id,
    )
    db.add(cuidador)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(Cuidador).where(Cuidador.email == dados.email)) is not None:
            raise _erro_email_duplicado()
        raise
    db.refresh(cuidador)
    return cuidador


def listar_cuidadores(db: Session) -> list[Cuidador]:
    return list(db.scalars(select(Cuidador)).all())


def autenticar_cuidador(db: Session, email: str, senha: str) -> Cuidador | None:
    cuidador = db.scalar(select(Cuidador).where(Cuidador.email == email))
    if cuidador is None:
        return None
    if not bcrypt.checkpw(senha.encode(), cuidador.senha_hash.encode()):
        return None
    return cuidador
