from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.cuidador import CuidadorVinculado


class IdosoCreate(BaseModel):
    nome: str = Field(min_length=1)
    data_nascimento: date
    observacoes: str | None = None

    @field_validator("data_nascimento")
    @classmethod
    def data_nascimento_nao_pode_ser_futura(cls, valor: date) -> date:
        if valor > date.today():
            raise ValueError("Data de nascimento não pode ser no futuro")
        return valor


class IdosoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    data_nascimento: date
    idade: int
    observacoes: str | None
    cuidadores: list[CuidadorVinculado]
