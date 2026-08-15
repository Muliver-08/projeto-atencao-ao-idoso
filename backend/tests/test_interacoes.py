from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.interacao import InteracaoMedicamentosa, NivelRisco


def _criar_idoso(client: TestClient) -> int:
    client.post(
        "/cuidadores",
        json={
            "nome": "Ana",
            "telefone": "(51) 99999-9999",
            "email": "ana@example.com",
            "senha": "senha123",
        },
    )
    client.post("/sessao/login", json={"email": "ana@example.com", "senha": "senha123"})
    resposta = client.post(
        "/idosos", json={"nome": "Idoso Teste", "data_nascimento": "1950-01-01"}
    )
    return resposta.json()["id"]


def _adicionar_interacao(
    db: Session, principio_a: str, principio_b: str, nivel: NivelRisco
) -> None:
    db.add(
        InteracaoMedicamentosa(
            principio_ativo_a=principio_a, principio_ativo_b=principio_b, nivel_risco=nivel
        )
    )
    db.commit()


def _medicamento(nome: str, principio_ativo: str, dosagem: str = "10mg") -> dict:
    return {
        "nome": nome,
        "principio_ativo": principio_ativo,
        "dosagem": dosagem,
        "horario": "08:00:00",
        "frequencia_horas": 8,
    }


def test_interacao_alta_bloqueia_e_libera_com_confirmacao(
    client: TestClient, db: Session
) -> None:
    _adicionar_interacao(db, "droga-a", "droga-b", NivelRisco.alto)
    idoso_id = _criar_idoso(client)
    client.post(f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med A", "droga-a"))

    bloqueada = client.post(
        f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med B", "droga-b")
    )
    assert bloqueada.status_code == 409
    detalhe = bloqueada.json()["detail"]
    assert detalhe["interacao"]["nivel_risco"] == "alto"

    liberada = client.post(
        f"/idosos/{idoso_id}/medicamentos",
        json={**_medicamento("Med B", "droga-b"), "confirmar_risco_alto": True},
    )
    assert liberada.status_code == 201
    assert liberada.json()["interacao"] is None


def test_interacao_moderada_nao_bloqueia(client: TestClient, db: Session) -> None:
    _adicionar_interacao(db, "droga-c", "droga-d", NivelRisco.moderado)
    idoso_id = _criar_idoso(client)
    client.post(f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med C", "droga-c"))

    resposta = client.post(
        f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med D", "droga-d")
    )

    assert resposta.status_code == 201
    assert resposta.json()["interacao"]["nivel_risco"] == "moderado"


def test_multiplas_interacoes_retorna_maior_risco(
    client: TestClient, db: Session
) -> None:
    _adicionar_interacao(db, "droga-e", "droga-f", NivelRisco.moderado)
    _adicionar_interacao(db, "droga-g", "droga-f", NivelRisco.alto)
    idoso_id = _criar_idoso(client)
    client.post(f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med E", "droga-e"))
    client.post(f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med G", "droga-g"))

    resposta = client.post(
        f"/idosos/{idoso_id}/medicamentos", json=_medicamento("Med F", "droga-f")
    )

    assert resposta.status_code == 409
    assert resposta.json()["detail"]["interacao"]["nivel_risco"] == "alto"
