from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

idoso_cuidador = Table(
    "idoso_cuidador",
    Base.metadata,
    Column("idoso_id", ForeignKey("idosos.id"), primary_key=True),
    Column("cuidador_id", ForeignKey("cuidadores.id"), primary_key=True),
    Column("vinculado_em", DateTime, server_default=func.now(), nullable=False),
    Column("vinculado_por_cuidador_id", ForeignKey("cuidadores.id"), nullable=True),
)


class Cuidador(Base):
    __tablename__ = "cuidadores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str]
    telefone: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True, index=True)
    senha_hash: Mapped[str]
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    criado_por_cuidador_id: Mapped[int | None] = mapped_column(
        ForeignKey("cuidadores.id")
    )

    idosos: Mapped[list["Idoso"]] = relationship(
        secondary=idoso_cuidador,
        primaryjoin="Cuidador.id == idoso_cuidador.c.cuidador_id",
        secondaryjoin="Idoso.id == idoso_cuidador.c.idoso_id",
        back_populates="cuidadores",
    )
