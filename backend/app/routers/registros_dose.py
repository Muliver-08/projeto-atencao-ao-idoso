from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.registro_dose import RegistroDoseCreate, RegistroDoseRead
from app.services import idoso_service, registro_dose_service

router = APIRouter(tags=["registros_dose"])


@router.post(
    "/medicamentos/{medicamento_id}/doses",
    response_model=RegistroDoseRead,
    status_code=201,
)
def confirmar_dose(
    medicamento_id: int,
    dados: RegistroDoseCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> RegistroDoseRead:
    try:
        return registro_dose_service.confirmar_dose(
            db, medicamento_id, dados, cuidador_atual_id
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível confirmar a dose."
        )


@router.get("/idosos/{idoso_id}/doses", response_model=list[RegistroDoseRead])
def listar_doses(
    idoso_id: int,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> list[RegistroDoseRead]:
    if cuidador_atual_id is None:
        raise HTTPException(status_code=401, detail="É preciso estar logado.")
    try:
        idoso_service.obter_idoso(db, idoso_id, cuidador_atual_id)
        return registro_dose_service.listar_doses(db, idoso_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar o histórico de doses."
        )
