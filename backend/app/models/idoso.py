from datetime import date, datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.cuidador import Cuidador, idoso_cuidador


class Idoso(Base):
    __tablename__ = "idosos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str]
    data_nascimento: Mapped[date]
    observacoes: Mapped[str | None]
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    criado_por_cuidador_id: Mapped[int | None] = mapped_column(
        ForeignKey("cuidadores.id")
    )

    cuidadores: Mapped[list[Cuidador]] = relationship(
        secondary=idoso_cuidador,
        primaryjoin="Idoso.id == idoso_cuidador.c.idoso_id",
        secondaryjoin="Cuidador.id == idoso_cuidador.c.cuidador_id",
        back_populates="idosos",
    )

    @property
    def idade(self) -> int:
        hoje = date.today()
        anos = hoje.year - self.data_nascimento.year
        if (hoje.month, hoje.day) < (
            self.data_nascimento.month,
            self.data_nascimento.day,
        ):
            anos -= 1
        return anos
