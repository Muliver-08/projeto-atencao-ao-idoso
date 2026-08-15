from fastapi.testclient import TestClient


def _cadastrar_e_logar(client: TestClient, nome: str, email: str) -> int:
    cuidador = client.post(
        "/cuidadores",
        json={
            "nome": nome,
            "telefone": "(51) 99999-9999",
            "email": email,
            "senha": "senha123",
        },
    ).json()
    client.post("/sessao/login", json={"email": email, "senha": "senha123"})
    return cuidador["id"]


def _logar(client: TestClient, email: str) -> None:
    client.post("/sessao/login", json={"email": email, "senha": "senha123"})


def test_criar_convite_para_email_sem_cadastro_retorna_404(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()

    resposta = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "naoexiste@example.com"}
    )

    assert resposta.status_code == 404


def test_criar_convite_sem_vinculo_ao_idoso_retorna_403(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _cadastrar_e_logar(client, "Carla", "carla@example.com")

    resposta = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "carla@example.com"}
    )

    assert resposta.status_code == 403


def test_convite_pendente_duplicado_e_substituido(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _logar(client, "ana@example.com")

    primeiro = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "beto@example.com"}
    ).json()
    segundo = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "beto@example.com"}
    ).json()

    assert primeiro["id"] != segundo["id"]
    _logar(client, "beto@example.com")
    convites = client.get("/convites").json()
    assert len(convites) == 1
    assert convites[0]["id"] == segundo["id"]


def test_aceitar_convite_cria_vinculo(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _logar(client, "ana@example.com")
    convite = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "beto@example.com"}
    ).json()

    _logar(client, "beto@example.com")
    resposta = client.post(f"/convites/{convite['id']}/aceitar")

    assert resposta.status_code == 204
    idosos_do_beto = client.get("/idosos").json()
    assert any(i["id"] == idoso["id"] for i in idosos_do_beto)
    assert client.get("/convites").json() == []


def test_recusar_convite_nao_cria_vinculo(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _logar(client, "ana@example.com")
    convite = client.post(
        f"/idosos/{idoso['id']}/convites", json={"email": "beto@example.com"}
    ).json()

    _logar(client, "beto@example.com")
    resposta = client.post(f"/convites/{convite['id']}/recusar")

    assert resposta.status_code == 204
    assert client.get("/idosos").json() == []
    assert client.get("/convites").json() == []
