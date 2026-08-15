from pydantic import BaseModel, ConfigDict, Field


TELEFONE_PATTERN = r"^\(\d{2}\) \d{4,5}-\d{4}$"


class CuidadorCreate(BaseModel):
    nome: str = Field(min_length=1)
    telefone: str = Field(
        pattern=TELEFONE_PATTERN,
        description="Formato (xx) xxxxx-xxxx (celular) ou (xx) xxxx-xxxx (fixo)",
    )


class CuidadorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    telefone: str
