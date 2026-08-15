from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.interacao import NivelRisco
from app.routers.sessao import get_cuidador_atual_id
from app.schemas.interacao import InteracaoRead
from app.schemas.medicamento import (
    MedicamentoCreate,
    MedicamentoCriado,
    MedicamentoRead,
    MedicamentoUpdate,
)
from app.services import idoso_service, interacao_service, medicamento_service

router = APIRouter(tags=["medicamentos"])


@router.post(
    "/idosos/{idoso_id}/medicamentos", response_model=MedicamentoCriado, status_code=201
)
def criar_medicamento(
    idoso_id: int,
    dados: MedicamentoCreate,
    db: Session = Depends(get_db),
    cuidador_atual_id: int | None = Depends(get_cuidador_atual_id),
) -> MedicamentoCriado:
    try:
        idoso_service.obter_idoso(db, idoso_id)

        interacao = interacao_service.verificar_interacao(
            db, idoso_id, dados.principio_ativo
        )
        # 409 com `detail` como objeto (não string) — exceção ao padrão dos demais
        # endpoints, pois a UI precisa dos dados da interação pra desenhar o modal.
        if interacao is not None and interacao.nivel_risco == NivelRisco.alto and not dados.confirmar_risco_alto:
            raise HTTPException(
                status_code=409,
                detail={
                    "mensagem": "Interação de risco alto identificada. Confirme para prosseguir.",
                    "interacao": InteracaoRead.model_validate(interacao).model_dump(
                        mode="json"
                    ),
                },
            )

        medicamento = medicamento_service.criar_medicamento(
            db, idoso_id, dados, cuidador_atual_id
        )
        interacao_resposta = (
            None if interacao is not None and interacao.nivel_risco == NivelRisco.alto else interacao
        )
        return MedicamentoCriado(
            medicamento=MedicamentoRead.model_validate(medicamento),
            interacao=InteracaoRead.model_validate(interacao_resposta)
            if interacao_resposta is not None
            else None,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível cadastrar o medicamento."
        )


@router.get("/idosos/{idoso_id}/medicamentos", response_model=list[MedicamentoRead])
def listar_medicamentos(
    idoso_id: int, db: Session = Depends(get_db)
) -> list[MedicamentoRead]:
    try:
        idoso_service.obter_idoso(db, idoso_id)
        return medicamento_service.listar_medicamentos(db, idoso_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível listar os medicamentos."
        )


@router.patch("/medicamentos/{medicamento_id}", response_model=MedicamentoRead)
def atualizar_medicamento(
    medicamento_id: int, dados: MedicamentoUpdate, db: Session = Depends(get_db)
) -> MedicamentoRead:
    try:
        return medicamento_service.atualizar_medicamento(db, medicamento_id, dados)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível atualizar o medicamento."
        )


@router.delete("/medicamentos/{medicamento_id}", status_code=204)
def remover_medicamento(medicamento_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        medicamento_service.inativar_medicamento(db, medicamento_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500, detail="Não foi possível remover o medicamento."
        )
    return Response(status_code=204)
