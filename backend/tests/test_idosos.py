from fastapi.testclient import TestClient


def _cadastrar_e_logar(client: TestClient, nome: str = "Ana", email: str = "ana@example.com") -> int:
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


def test_criar_idoso_sem_sessao_retorna_401(client: TestClient) -> None:
    resposta = client.post(
        "/idosos",
        json={"nome": "Maria", "data_nascimento": "1950-01-01", "observacoes": None},
    )

    assert resposta.status_code == 401


def test_criar_idoso_sucesso_vincula_cuidador_criador(client: TestClient) -> None:
    _cadastrar_e_logar(client)

    resposta = client.post(
        "/idosos",
        json={"nome": "Maria", "data_nascimento": "1950-01-01", "observacoes": None},
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome"] == "Maria"
    assert len(corpo["cuidadores"]) == 1
    assert corpo["cuidadores"][0]["nome"] == "Ana"


def test_criar_idoso_nome_vazio_retorna_422(client: TestClient) -> None:
    _cadastrar_e_logar(client)

    resposta = client.post(
        "/idosos", json={"nome": "", "data_nascimento": "1950-01-01"}
    )

    assert resposta.status_code == 422


def test_listar_idosos_retorna_so_os_vinculados_ao_cuidador_logado(
    client: TestClient,
) -> None:
    _cadastrar_e_logar(client, nome="Ana", email="ana@example.com")
    client.post("/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"})

    _cadastrar_e_logar(client, nome="Beto", email="beto@example.com")
    client.post("/idosos", json={"nome": "Joao", "data_nascimento": "1945-05-10"})

    resposta = client.get("/idosos")

    assert resposta.status_code == 200
    nomes = {item["nome"] for item in resposta.json()}
    assert nomes == {"Joao"}


def test_obter_idoso_nao_vinculado_retorna_404(client: TestClient) -> None:
    _cadastrar_e_logar(client, nome="Ana", email="ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()

    _cadastrar_e_logar(client, nome="Beto", email="beto@example.com")
    resposta = client.get(f"/idosos/{idoso['id']}")

    assert resposta.status_code == 404
