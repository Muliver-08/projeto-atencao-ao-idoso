import enum

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NivelRisco(str, enum.Enum):
    baixo = "baixo"
    moderado = "moderado"
    alto = "alto"


class InteracaoMedicamentosa(Base):
    __tablename__ = "interacoes_medicamentosas"

    id: Mapped[int] = mapped_column(primary_key=True)
    principio_ativo_a: Mapped[str] = mapped_column(String, index=True)
    principio_ativo_b: Mapped[str] = mapped_column(String, index=True)
    nivel_risco: Mapped[NivelRisco] = mapped_column(Enum(NivelRisco, name="nivel_risco"))
