from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


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


def test_criar_medicamento_sucesso(client: TestClient) -> None:
    idoso_id = _criar_idoso(client)

    resposta = client.post(
        f"/idosos/{idoso_id}/medicamentos",
        json={
            "nome": "Paracetamol",
            "principio_ativo": "paracetamol",
            "dosagem": "500mg",
            "horario": "08:00:00",
            "frequencia_horas": 8,
        },
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["medicamento"]["nome"] == "Paracetamol"
    assert corpo["medicamento"]["ativo"] is True
    assert corpo["interacao"] is None


def test_criar_medicamento_duplicado_retorna_422(client: TestClient) -> None:
    idoso_id = _criar_idoso(client)
    dados = {
        "nome": "Paracetamol",
        "principio_ativo": "paracetamol",
        "dosagem": "500mg",
        "horario": "08:00:00",
        "frequencia_horas": 8,
    }
    client.post(f"/idosos/{idoso_id}/medicamentos", json=dados)

    resposta = client.post(f"/idosos/{idoso_id}/medicamentos", json=dados)

    assert resposta.status_code == 422


def test_remover_medicamento_soft_delete(client: TestClient, db: Session) -> None:
    idoso_id = _criar_idoso(client)
    criado = client.post(
        f"/idosos/{idoso_id}/medicamentos",
        json={
            "nome": "Paracetamol",
            "principio_ativo": "paracetamol",
            "dosagem": "500mg",
            "horario": "08:00:00",
            "frequencia_horas": 8,
        },
    ).json()
    medicamento_id = criado["medicamento"]["id"]

    resposta = client.delete(f"/medicamentos/{medicamento_id}")
    assert resposta.status_code == 204

    listagem = client.get(f"/idosos/{idoso_id}/medicamentos")
    assert listagem.json() == []

    from app.models.medicamento import Medicamento

    medicamento_no_banco = db.get(Medicamento, medicamento_id)
    assert medicamento_no_banco is not None
    assert medicamento_no_banco.ativo is False


def test_listar_medicamentos_retorna_so_ativos(client: TestClient) -> None:
    idoso_id = _criar_idoso(client)
    criado = client.post(
        f"/idosos/{idoso_id}/medicamentos",
        json={
            "nome": "Paracetamol",
            "principio_ativo": "paracetamol",
            "dosagem": "500mg",
            "horario": "08:00:00",
            "frequencia_horas": 8,
        },
    ).json()
    client.delete(f"/medicamentos/{criado['medicamento']['id']}")

    client.post(
        f"/idosos/{idoso_id}/medicamentos",
        json={
            "nome": "Dipirona",
            "principio_ativo": "dipirona",
            "dosagem": "1g",
            "horario": "09:00:00",
            "frequencia_horas": 6,
        },
    )

    resposta = client.get(f"/idosos/{idoso_id}/medicamentos")

    assert resposta.status_code == 200
    nomes = {item["nome"] for item in resposta.json()}
    assert nomes == {"Dipirona"}
