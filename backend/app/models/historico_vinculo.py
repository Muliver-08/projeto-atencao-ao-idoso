from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.cuidador import Cuidador


class TipoEventoVinculo(str, PyEnum):
    SAIU = "saiu"
    REMOVIDO = "removido"


class HistoricoVinculo(Base):
    __tablename__ = "historico_vinculo"

    id: Mapped[int] = mapped_column(primary_key=True)
    idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
    cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
    tipo_evento: Mapped[TipoEventoVinculo] = mapped_column(
        Enum(TipoEventoVinculo, name="tipo_evento_vinculo")
    )
    realizado_por_cuidador_id: Mapped[int | None] = mapped_column(
        ForeignKey("cuidadores.id")
    )
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())

    cuidador: Mapped[Cuidador] = relationship(foreign_keys=[cuidador_id])
    realizado_por: Mapped[Cuidador | None] = relationship(
        foreign_keys=[realizado_por_cuidador_id]
    )
