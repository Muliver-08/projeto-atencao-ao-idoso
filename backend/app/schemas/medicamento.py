from datetime import time

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.interacao import InteracaoRead


class MedicamentoCreate(BaseModel):
    nome: str = Field(min_length=1)
    principio_ativo: str = Field(min_length=1)
    dosagem: str = Field(min_length=1)
    horario: time
    frequencia_horas: int = Field(gt=0, le=24)
    registro_ms: str | None = None
    confirmar_risco_alto: bool = False


class MedicamentoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1)
    principio_ativo: str | None = Field(default=None, min_length=1)
    dosagem: str | None = Field(default=None, min_length=1)
    horario: time | None = None
    frequencia_horas: int | None = Field(default=None, gt=0, le=24)
    registro_ms: str | None = None


class MedicamentoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    idoso_id: int
    nome: str
    principio_ativo: str
    dosagem: str
    horario: time
    frequencia_horas: int
    registro_ms: str | None
    ativo: bool


class MedicamentoCriado(BaseModel):
    medicamento: MedicamentoRead
    interacao: InteracaoRead | None
