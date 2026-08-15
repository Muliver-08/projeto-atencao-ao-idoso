from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.cuidador import CuidadorCreate, CuidadorRead
from app.services import cuidador_service

router = APIRouter(tags=["cuidadores"])


@router.post("/cuidadores", response_model=CuidadorRead, status_code=201)
def criar_cuidador(
    dados: CuidadorCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> CuidadorRead:
    try:
        return cuidador_service.criar_cuidador(db, dados, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível cadastrar o cuidador."
        )


@router.get("/cuidadores", response_model=list[CuidadorRead])
def listar_cuidadores(db: Session = Depends(get_db)) -> list[CuidadorRead]:
    try:
        return cuidador_service.listar_cuidadores(db)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar os cuidadores."
        )


@router.post("/idosos/{idoso_id}/cuidadores/{cuidador_id}", status_code=204)
def vincular_cuidador(
    idoso_id: int,
    cuidador_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> Response:
    try:
        cuidador_service.vincular_cuidador(
            db, idoso_id, cuidador_id, cuidador_atual_id
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível vincular o cuidador ao idoso."
        )
    return Response(status_code=204)
