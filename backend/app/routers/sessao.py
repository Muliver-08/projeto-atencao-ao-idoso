from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.cuidador import CuidadorLogin
from app.services import cuidador_service

router = APIRouter(prefix="/sessao", tags=["sessao"])


class SessaoRead(BaseModel):
    cuidador_id: int | None


def get_cuidador_atual_id(request: Request) -> int | None:
    return request.session.get("cuidador_id")


@router.post("/login", status_code=204)
def login(
    dados: CuidadorLogin, request: Request, db: Session = Depends(get_db)
) -> Response:
    try:
        cuidador = cuidador_service.autenticar_cuidador(db, dados.email, dados.senha)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível fazer login."
        )
    if cuidador is None:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos.")

    request.session["cuidador_id"] = cuidador.id
    return Response(status_code=204)


@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=204)


@router.get("", response_model=SessaoRead)
def obter_sessao(
    cuidador_id: int | None = Depends(get_cuidador_atual_id),
) -> SessaoRead:
    return SessaoRead(cuidador_id=cuidador_id)
