from pydantic import BaseModel, ConfigDict

from app.models.interacao import NivelRisco


class InteracaoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    principio_ativo_a: str
    principio_ativo_b: str
    nivel_risco: NivelRisco
