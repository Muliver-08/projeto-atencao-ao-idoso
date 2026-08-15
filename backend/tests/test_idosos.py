from fastapi.testclient import TestClient


def test_criar_idoso_sucesso(client: TestClient) -> None:
    resposta = client.post(
        "/idosos",
        json={"nome": "Maria", "data_nascimento": "1950-01-01", "observacoes": None},
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome"] == "Maria"
    assert corpo["cuidadores"] == []


def test_criar_idoso_nome_vazio_retorna_422(client: TestClient) -> None:
    resposta = client.post(
        "/idosos", json={"nome": "", "data_nascimento": "1950-01-01"}
    )

    assert resposta.status_code == 422


def test_listar_idosos(client: TestClient) -> None:
    client.post("/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"})
    client.post("/idosos", json={"nome": "Joao", "data_nascimento": "1945-05-10"})

    resposta = client.get("/idosos")

    assert resposta.status_code == 200
    nomes = {item["nome"] for item in resposta.json()}
    assert nomes == {"Maria", "Joao"}
