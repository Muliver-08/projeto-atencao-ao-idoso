from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.main import app
from app.models import cuidador, idoso, convite_vinculo, historico_vinculo  # noqa: F401 - registra tabelas no metadata
from app.models.base import Base

_TEST_DB_URL = make_url(settings.DATABASE_URL).set(
    database=make_url(settings.DATABASE_URL).database + "_test"
)


def _garantir_banco_teste() -> None:
    admin_url = make_url(settings.DATABASE_URL).set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            try:
                conn.execute(text(f'CREATE DATABASE "{_TEST_DB_URL.database}"'))
            except ProgrammingError:
                pass
    finally:
        admin_engine.dispose()


_garantir_banco_teste()
engine = create_engine(_TEST_DB_URL)
Base.metadata.create_all(engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    connection = engine.connect()
    transacao = connection.begin()
    sessao = Session(bind=connection, join_transaction_mode="create_savepoint")

    yield sessao

    sessao.close()
    transacao.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
