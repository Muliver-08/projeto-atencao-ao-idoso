from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.cuidador import CuidadorRead


class RegistroDoseCreate(BaseModel):
    observacao: str | None = None


class RegistroDoseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medicamento_id: int
    horario_previsto: datetime
    confirmado_em: datetime
    observacao: str | None
    cuidador: CuidadorRead
