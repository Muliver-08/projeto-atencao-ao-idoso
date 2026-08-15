from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.convite_vinculo import StatusConvite
from app.schemas.cuidador import CuidadorRead


class ConviteCreate(BaseModel):
    email: EmailStr


class ConviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    idoso_id: int
    solicitado_por: CuidadorRead
    status: StatusConvite
    criado_em: datetime
