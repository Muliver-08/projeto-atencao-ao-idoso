from fastapi.testclient import TestClient


def _criar_cuidador(client: TestClient, email: str = "ana@example.com") -> int:
    resposta = client.post(
        "/cuidadores",
        json={
            "nome": "Ana",
            "telefone": "(51) 99999-9999",
            "email": email,
            "senha": "senha123",
        },
    )
    return resposta.json()["id"]


def test_login_com_credenciais_corretas_seta_cookie_httponly(client: TestClient) -> None:
    _criar_cuidador(client)

    resposta = client.post(
        "/sessao/login", json={"email": "ana@example.com", "senha": "senha123"}
    )

    assert resposta.status_code == 204
    set_cookie = resposta.headers.get("set-cookie", "")
    assert "httponly" in set_cookie.lower()


def test_login_com_senha_incorreta_retorna_401(client: TestClient) -> None:
    _criar_cuidador(client)

    resposta = client.post(
        "/sessao/login", json={"email": "ana@example.com", "senha": "errada123"}
    )

    assert resposta.status_code == 401


def test_login_com_email_inexistente_retorna_401(client: TestClient) -> None:
    resposta = client.post(
        "/sessao/login", json={"email": "naoexiste@example.com", "senha": "senha123"}
    )

    assert resposta.status_code == 401


def test_obter_sessao_retorna_cuidador_atual(client: TestClient) -> None:
    cuidador_id = _criar_cuidador(client)
    client.post("/sessao/login", json={"email": "ana@example.com", "senha": "senha123"})

    resposta = client.get("/sessao")

    assert resposta.status_code == 200
    assert resposta.json()["cuidador_id"] == cuidador_id


def test_logout_limpa_sessao(client: TestClient) -> None:
    _criar_cuidador(client)
    client.post("/sessao/login", json={"email": "ana@example.com", "senha": "senha123"})

    resposta_logout = client.post("/sessao/logout")
    resposta_sessao = client.get("/sessao")

    assert resposta_logout.status_code == 204
    assert resposta_sessao.json()["cuidador_id"] is None
