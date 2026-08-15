from fastapi.testclient import TestClient


def _criar_idoso(client: TestClient) -> int:
    resposta = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    )
    return resposta.json()["id"]


def _criar_cuidador(client: TestClient, telefone: str = "(51) 99999-9999") -> int:
    resposta = client.post("/cuidadores", json={"nome": "Ana", "telefone": telefone})
    return resposta.json()["id"]


def test_criar_cuidador_sucesso(client: TestClient) -> None:
    resposta = client.post(
        "/cuidadores", json={"nome": "Ana", "telefone": "(51) 99999-9999"}
    )

    assert resposta.status_code == 201
    assert resposta.json()["nome"] == "Ana"


def test_vincular_cuidador_a_idoso(client: TestClient) -> None:
    idoso_id = _criar_idoso(client)
    cuidador_id = _criar_cuidador(client)

    resposta = client.post(f"/idosos/{idoso_id}/cuidadores/{cuidador_id}")

    assert resposta.status_code == 204
    idoso = client.get(f"/idosos/{idoso_id}").json()
    assert len(idoso["cuidadores"]) == 1
    assert idoso["cuidadores"][0]["id"] == cuidador_id


def test_vinculo_duplicado_nao_gera_duplicata(client: TestClient) -> None:
    idoso_id = _criar_idoso(client)
    cuidador_id = _criar_cuidador(client)

    client.post(f"/idosos/{idoso_id}/cuidadores/{cuidador_id}")
    resposta = client.post(f"/idosos/{idoso_id}/cuidadores/{cuidador_id}")

    assert resposta.status_code == 204
    idoso = client.get(f"/idosos/{idoso_id}").json()
    assert len(idoso["cuidadores"]) == 1
