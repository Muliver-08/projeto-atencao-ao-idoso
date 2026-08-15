from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.idoso import IdosoCreate, IdosoRead
from app.services import idoso_service

router = APIRouter(prefix="/idosos", tags=["idosos"])


@router.post("", response_model=IdosoRead, status_code=201)
def criar_idoso(
    dados: IdosoCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> IdosoRead:
    try:
        return idoso_service.criar_idoso(db, dados, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível cadastrar o idoso."
        )


@router.get("", response_model=list[IdosoRead])
def listar_idosos(db: Session = Depends(get_db)) -> list[IdosoRead]:
    try:
        return idoso_service.listar_idosos(db)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar os idosos."
        )


@router.get("/{idoso_id}", response_model=IdosoRead)
def obter_idoso(idoso_id: int, db: Session = Depends(get_db)) -> IdosoRead:
    try:
        return idoso_service.obter_idoso(db, idoso_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível buscar o idoso."
        )
