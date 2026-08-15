from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.historico_vinculo import HistoricoVinculoRead
from app.schemas.idoso import IdosoCreate, IdosoRead
from app.services import idoso_service, vinculo_service

router = APIRouter(prefix="/idosos", tags=["idosos"])


@router.post("", response_model=IdosoRead, status_code=201)
def criar_idoso(
    dados: IdosoCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> IdosoRead:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        return idoso_service.criar_idoso(db, dados, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível cadastrar o idoso."
        )


@router.get("", response_model=list[IdosoRead])
def listar_idosos(
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> list[IdosoRead]:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        return idoso_service.listar_idosos(db, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar os idosos."
        )


@router.get("/{idoso_id}", response_model=IdosoRead)
def obter_idoso(
    idoso_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> IdosoRead:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        return idoso_service.obter_idoso(db, idoso_id, cuidador_atual_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível buscar o idoso."
        )


@router.delete("/{idoso_id}/cuidadores/{cuidador_id}", status_code=204)
def desvincular_cuidador(
    idoso_id: int,
    cuidador_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> Response:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        vinculo_service.desvincular_cuidador(
            db, idoso_id, cuidador_id, cuidador_atual_id
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível desvincular o cuidador."
        )
    return Response(status_code=204)


@router.get("/{idoso_id}/historico-vinculo", response_model=list[HistoricoVinculoRead])
def listar_historico_vinculo(
    idoso_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> list[HistoricoVinculoRead]:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        idoso_service.obter_idoso(db, idoso_id, cuidador_atual_id)
        return vinculo_service.listar_historico_vinculo(db, idoso_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar o histórico de vínculo."
        )
