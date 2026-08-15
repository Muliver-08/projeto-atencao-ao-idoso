from dataclasses import dataclass

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.interacao import InteracaoMedicamentosa, NivelRisco
from app.models.medicamento import Medicamento

_ORDEM_RISCO = {NivelRisco.baixo: 0, NivelRisco.moderado: 1, NivelRisco.alto: 2}


@dataclass
class InteracaoEncontrada:
    principio_ativo_a: str
    principio_ativo_b: str
    nivel_risco: NivelRisco


def verificar_interacao(
    db: Session, idoso_id: int, principio_ativo: str
) -> InteracaoEncontrada | None:
    principios_ativos = db.scalars(
        select(Medicamento.principio_ativo).where(
            Medicamento.idoso_id == idoso_id, Medicamento.ativo.is_(True)
        )
    ).all()
    if not principios_ativos:
        return None

    interacoes = db.scalars(
        select(InteracaoMedicamentosa).where(
            or_(
                and_(
                    InteracaoMedicamentosa.principio_ativo_a == principio_ativo,
                    InteracaoMedicamentosa.principio_ativo_b.in_(principios_ativos),
                ),
                and_(
                    InteracaoMedicamentosa.principio_ativo_b == principio_ativo,
                    InteracaoMedicamentosa.principio_ativo_a.in_(principios_ativos),
                ),
            )
        )
    ).all()
    if not interacoes:
        return None

    mais_grave = max(interacoes, key=lambda i: _ORDEM_RISCO[i.nivel_risco])
    return InteracaoEncontrada(
        principio_ativo_a=mais_grave.principio_ativo_a,
        principio_ativo_b=mais_grave.principio_ativo_b,
        nivel_risco=mais_grave.nivel_risco,
    )
