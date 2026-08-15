from app.database import SessionLocal
from app.models.interacao import InteracaoMedicamentosa, NivelRisco

# Placeholder fictício — substituir por dados curados reais da equipe antes de qualquer uso real.
DADOS_PLACEHOLDER = [
    ("principio-teste-a", "principio-teste-b", NivelRisco.alto),
    ("principio-teste-c", "principio-teste-d", NivelRisco.moderado),
    ("principio-teste-e", "principio-teste-f", NivelRisco.baixo),
]


def seed() -> None:
    db = SessionLocal()
    try:
        for principio_a, principio_b, nivel in DADOS_PLACEHOLDER:
            existe = (
                db.query(InteracaoMedicamentosa)
                .filter_by(principio_ativo_a=principio_a, principio_ativo_b=principio_b)
                .first()
            )
            if existe is None:
                db.add(
                    InteracaoMedicamentosa(
                        principio_ativo_a=principio_a,
                        principio_ativo_b=principio_b,
                        nivel_risco=nivel,
                    )
                )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
