from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.cuidador import Cuidador

router = APIRouter(prefix="/sessao", tags=["sessao"])


class SessaoCreate(BaseModel):
    cuidador_id: int


class SessaoRead(BaseModel):
    cuidador_id: int | None


def get_cuidador_atual_id(request: Request) -> int | None:
    return request.session.get("cuidador_id")


@router.post("", status_code=204)
def selecionar_cuidador(
    dados: SessaoCreate, request: Request, db: Session = Depends(get_db)
) -> Response:
    try:
        cuidador = db.get(Cuidador, dados.cuidador_id)
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível selecionar o cuidador."
        )
    if cuidador is None:
        raise HTTPException(status_code=404, detail="Cuidador não encontrado")

    request.session["cuidador_id"] = dados.cuidador_id
    return Response(status_code=204)


@router.get("", response_model=SessaoRead)
def obter_sessao(
    cuidador_id: int | None = Depends(get_cuidador_atual_id),
) -> SessaoRead:
    return SessaoRead(cuidador_id=cuidador_id)
