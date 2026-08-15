from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import cuidadores, idosos, medicamentos, registros_dose, sessao

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY,
    https_only=False,
    same_site="lax",
)


app.include_router(idosos.router)
app.include_router(cuidadores.router)
app.include_router(medicamentos.router)
app.include_router(registros_dose.router)
app.include_router(sessao.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
