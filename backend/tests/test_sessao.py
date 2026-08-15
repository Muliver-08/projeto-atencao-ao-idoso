from fastapi.testclient import TestClient


def _criar_cuidador(client: TestClient) -> int:
    resposta = client.post(
        "/cuidadores", json={"nome": "Ana", "telefone": "(51) 99999-9999"}
    )
    return resposta.json()["id"]


def test_selecionar_cuidador_seta_cookie_httponly(client: TestClient) -> None:
    cuidador_id = _criar_cuidador(client)

    resposta = client.post("/sessao", json={"cuidador_id": cuidador_id})

    assert resposta.status_code == 204
    set_cookie = resposta.headers.get("set-cookie", "")
    assert "httponly" in set_cookie.lower()


def test_obter_sessao_retorna_cuidador_atual(client: TestClient) -> None:
    cuidador_id = _criar_cuidador(client)
    client.post("/sessao", json={"cuidador_id": cuidador_id})

    resposta = client.get("/sessao")

    assert resposta.status_code == 200
    assert resposta.json()["cuidador_id"] == cuidador_id


def test_selecionar_cuidador_inexistente_retorna_404(client: TestClient) -> None:
    resposta = client.post("/sessao", json={"cuidador_id": 999999})

    assert resposta.status_code == 404
