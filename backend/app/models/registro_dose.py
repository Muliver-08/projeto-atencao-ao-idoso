from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.cuidador import Cuidador


class RegistroDose(Base):
    __tablename__ = "registros_dose"
    __table_args__ = (
        UniqueConstraint("medicamento_id", "horario_previsto", name="uq_registro_dose_medicamento_horario"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    medicamento_id: Mapped[int] = mapped_column(ForeignKey("medicamentos.id"))
    cuidador_id: Mapped[int] = mapped_column(ForeignKey("cuidadores.id"))
    horario_previsto: Mapped[datetime] = mapped_column(DateTime)
    confirmado_em: Mapped[datetime] = mapped_column(server_default=func.now())
    observacao: Mapped[str | None]

    cuidador: Mapped[Cuidador] = relationship()
