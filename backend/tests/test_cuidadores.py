from fastapi.testclient import TestClient


def _dados_cuidador(nome: str = "Ana", email: str = "ana@example.com") -> dict:
    return {
        "nome": nome,
        "telefone": "(51) 99999-9999",
        "email": email,
        "senha": "senha123",
    }


def _criar_cuidador(client: TestClient, email: str = "ana@example.com") -> int:
    resposta = client.post("/cuidadores", json=_dados_cuidador(email=email))
    return resposta.json()["id"]


def _login(client: TestClient, email: str = "ana@example.com", senha: str = "senha123") -> None:
    client.post("/sessao/login", json={"email": email, "senha": senha})


def test_criar_cuidador_sucesso(client: TestClient) -> None:
    resposta = client.post("/cuidadores", json=_dados_cuidador())

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome"] == "Ana"
    assert corpo["email"] == "ana@example.com"
    assert "senha" not in corpo
    assert "senha_hash" not in corpo


def test_criar_cuidador_email_duplicado_retorna_409(client: TestClient) -> None:
    client.post("/cuidadores", json=_dados_cuidador())

    resposta = client.post("/cuidadores", json=_dados_cuidador(nome="Outra"))

    assert resposta.status_code == 409


def test_listar_cuidadores_sem_sessao_retorna_401(client: TestClient) -> None:
    resposta = client.get("/cuidadores")

    assert resposta.status_code == 401


def test_listar_cuidadores_com_sessao_retorna_lista(client: TestClient) -> None:
    _criar_cuidador(client)
    _login(client)

    resposta = client.get("/cuidadores")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 1
