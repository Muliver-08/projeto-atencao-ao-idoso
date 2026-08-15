from datetime import datetime, time

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Medicamento(Base):
    __tablename__ = "medicamentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    idoso_id: Mapped[int] = mapped_column(ForeignKey("idosos.id"))
    nome: Mapped[str]
    principio_ativo: Mapped[str] = mapped_column(index=True)
    dosagem: Mapped[str]
    horario: Mapped[time]
    frequencia_horas: Mapped[int]
    registro_ms: Mapped[str | None]
    ativo: Mapped[bool] = mapped_column(default=True, server_default="true")
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    criado_por_cuidador_id: Mapped[int | None] = mapped_column(
        ForeignKey("cuidadores.id")
    )
