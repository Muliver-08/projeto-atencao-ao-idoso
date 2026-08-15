from datetime import datetime, time, timedelta

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

TOLERANCIA_ATRASO_MINUTOS = 30


def calcular_horario_previsto(
    horario: time, frequencia_horas: int, agora: datetime
) -> datetime:
    ancora = datetime.combine(agora.date(), horario)
    if ancora > agora:
        ancora -= timedelta(days=1)
    intervalo = timedelta(hours=frequencia_horas)
    passos = (agora - ancora) // intervalo
    return ancora + passos * intervalo


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

    @property
    def proximo_horario_previsto(self) -> datetime:
        return calcular_horario_previsto(
            self.horario, self.frequencia_horas, datetime.now()
        )

    @property
    def atrasado(self) -> bool:
        limite = self.proximo_horario_previsto + timedelta(
            minutes=TOLERANCIA_ATRASO_MINUTOS
        )
        return datetime.now() > limite
