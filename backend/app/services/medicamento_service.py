from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.medicamento import Medicamento
from app.schemas.medicamento import MedicamentoCreate, MedicamentoUpdate


def _verificar_duplicado(
    db: Session,
    idoso_id: int,
    principio_ativo: str,
    dosagem: str,
    excluir_id: int | None = None,
) -> None:
    query = select(Medicamento).where(
        Medicamento.idoso_id == idoso_id,
        Medicamento.ativo.is_(True),
        Medicamento.principio_ativo == principio_ativo,
        Medicamento.dosagem == dosagem,
    )
    if excluir_id is not None:
        query = query.where(Medicamento.id != excluir_id)

    if db.scalars(query).first() is not None:
        raise HTTPException(
            status_code=422,
            detail="Este idoso já possui um medicamento ativo com o mesmo princípio ativo e dosagem.",
        )


def criar_medicamento(
    db: Session,
    idoso_id: int,
    dados: MedicamentoCreate,
    criado_por_cuidador_id: int | None,
) -> Medicamento:
    _verificar_duplicado(db, idoso_id, dados.principio_ativo, dados.dosagem)

    medicamento = Medicamento(
        idoso_id=idoso_id,
        nome=dados.nome,
        principio_ativo=dados.principio_ativo,
        dosagem=dados.dosagem,
        horario=dados.horario,
        frequencia_horas=dados.frequencia_horas,
        registro_ms=dados.registro_ms,
        criado_por_cuidador_id=criado_por_cuidador_id,
    )
    db.add(medicamento)
    db.commit()
    db.refresh(medicamento)
    return medicamento


def listar_medicamentos(db: Session, idoso_id: int) -> list[Medicamento]:
    return list(
        db.scalars(
            select(Medicamento).where(
                Medicamento.idoso_id == idoso_id, Medicamento.ativo.is_(True)
            )
        ).all()
    )


def obter_medicamento(db: Session, medicamento_id: int) -> Medicamento:
    medicamento = db.get(Medicamento, medicamento_id)
    if medicamento is None or not medicamento.ativo:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    return medicamento


def atualizar_medicamento(
    db: Session, medicamento_id: int, dados: MedicamentoUpdate
) -> Medicamento:
    medicamento = obter_medicamento(db, medicamento_id)

    novo_principio_ativo = dados.principio_ativo or medicamento.principio_ativo
    nova_dosagem = dados.dosagem or medicamento.dosagem
    if dados.principio_ativo is not None or dados.dosagem is not None:
        _verificar_duplicado(
            db,
            medicamento.idoso_id,
            novo_principio_ativo,
            nova_dosagem,
            excluir_id=medicamento.id,
        )

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(medicamento, campo, valor)

    db.commit()
    db.refresh(medicamento)
    return medicamento


def inativar_medicamento(db: Session, medicamento_id: int) -> None:
    medicamento = obter_medicamento(db, medicamento_id)
    medicamento.ativo = False
    db.commit()
