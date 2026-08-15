from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.cuidador import Cuidador


class StatusConvite(str, PyEnum):
    PENDENTE = "pendente"
    ACEITO = "aceito"
    RECUSADO = "recusado"


class ConviteVinculo(Base):
    __tablename__ = "convites_vinculo"

    id: Mapped[int] = mapped_column(primary_key=True)
    idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
    cuidador_convidado_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
    solicitado_por_cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
    status: Mapped[StatusConvite] = mapped_column(
        Enum(StatusConvite, name="status_convite"), default=StatusConvite.PENDENTE
    )
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    respondido_em: Mapped[datetime | None]

    solicitado_por: Mapped[Cuidador] = relationship(
        foreign_keys=[solicitado_por_cuidador_id]
    )
