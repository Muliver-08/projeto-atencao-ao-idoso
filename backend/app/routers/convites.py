from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.convite_vinculo import ConviteCreate, ConviteRead
from app.services import convite_service

router = APIRouter(tags=["convites"])


@router.post("/idosos/{idoso_id}/convites", response_model=ConviteRead, status_code=201)
def criar_convite(
    idoso_id: int,
    dados: ConviteCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> ConviteRead:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        return convite_service.criar_convite(
            db, idoso_id, dados.email, cuidador_atual_id
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Não foi possível criar o convite.")


@router.get("/convites", response_model=list[ConviteRead])
def listar_convites(
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> list[ConviteRead]:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        return convite_service.listar_convites_pendentes(db, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar os convites."
        )


@router.post("/convites/{convite_id}/aceitar", status_code=204)
def aceitar_convite(
    convite_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> None:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        convite_service.aceitar_convite(db, convite_id, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível aceitar o convite."
        )


@router.post("/convites/{convite_id}/recusar", status_code=204)
def recusar_convite(
    convite_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> None:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        convite_service.recusar_convite(db, convite_id, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível recusar o convite."
        )
