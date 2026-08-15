from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.historico_vinculo import TipoEventoVinculo
from app.schemas.cuidador import CuidadorRead


class HistoricoVinculoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    idoso_id: int
    cuidador: CuidadorRead
    tipo_evento: TipoEventoVinculo
    realizado_por: CuidadorRead | None
    criado_em: datetime
