from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cuidador import idoso_cuidador
from app.models.idoso import Idoso


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


def _vincular_por_convite(
    client: TestClient, idoso_id: int, dono_email: str, convidado_email: str
) -> None:
    _logar(client, dono_email)
    convite = client.post(
        f"/idosos/{idoso_id}/convites", json={"email": convidado_email}
    ).json()
    _logar(client, convidado_email)
    client.post(f"/convites/{convite['id']}/aceitar")


def _vinculo(db: Session, idoso_id: int, cuidador_id: int):
    return db.execute(
        select(idoso_cuidador).where(
            idoso_cuidador.c.idoso_id == idoso_id,
            idoso_cuidador.c.cuidador_id == cuidador_id,
        )
    ).first()


def test_dono_remove_outro_cuidador(client: TestClient, db: Session) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    beto_id = _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "beto@example.com")

    _logar(client, "ana@example.com")
    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{beto_id}")

    assert resposta.status_code == 204
    assert _vinculo(db, idoso["id"], beto_id) is None
    idoso_db = db.get(Idoso, idoso["id"])
    assert idoso_db.criado_por_cuidador_id == ana_id


def test_cuidador_comum_sai_por_conta_propria(client: TestClient, db: Session) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    beto_id = _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "beto@example.com")

    _logar(client, "beto@example.com")
    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{beto_id}")

    assert resposta.status_code == 204
    assert _vinculo(db, idoso["id"], beto_id) is None


def test_nao_dono_nao_pode_remover_terceiro(client: TestClient) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "beto@example.com")
    _cadastrar_e_logar(client, "Carla", "carla@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "carla@example.com")

    _logar(client, "beto@example.com")
    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{ana_id}")

    assert resposta.status_code == 403


def test_dono_sai_com_outro_cuidador_transfere_posse(
    client: TestClient, db: Session
) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    beto_id = _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "beto@example.com")
    _cadastrar_e_logar(client, "Carla", "carla@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "carla@example.com")

    _logar(client, "ana@example.com")
    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{ana_id}")

    assert resposta.status_code == 204
    idoso_db = db.get(Idoso, idoso["id"])
    assert idoso_db.criado_por_cuidador_id == beto_id  # vinculado antes da Carla


def test_dono_sai_sozinho_deixa_idoso_orfao(client: TestClient, db: Session) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()

    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{ana_id}")

    assert resposta.status_code == 204
    idoso_db = db.get(Idoso, idoso["id"])
    assert idoso_db.criado_por_cuidador_id is None
    assert _vinculo(db, idoso["id"], ana_id) is None


def test_nao_dono_nao_pode_ser_o_ultimo_a_sair(client: TestClient, db: Session) -> None:
    # A transferência automática de posse garante que o dono é sempre um dos
    # cuidadores vinculados enquanto houver algum — então esse bloqueio nunca
    # deveria disparar pelo fluxo normal da API. Forçamos o estado (idoso órfão
    # com um cuidador ainda vinculado) diretamente no banco para testar a
    # trava de segurança do serviço.
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()

    idoso_db = db.get(Idoso, idoso["id"])
    idoso_db.criado_por_cuidador_id = None
    db.commit()

    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{ana_id}")

    assert resposta.status_code == 409


def test_desvinculacao_gera_evento_no_historico(client: TestClient) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    beto_id = _cadastrar_e_logar(client, "Beto", "beto@example.com")
    _vincular_por_convite(client, idoso["id"], "ana@example.com", "beto@example.com")

    _logar(client, "beto@example.com")
    client.delete(f"/idosos/{idoso['id']}/cuidadores/{beto_id}")

    _logar(client, "ana@example.com")
    historico = client.get(f"/idosos/{idoso['id']}/historico-vinculo").json()

    assert len(historico) == 1
    assert historico[0]["cuidador"]["id"] == beto_id
    assert historico[0]["tipo_evento"] == "saiu"
    assert historico[0]["realizado_por"] is None


def test_desvincular_de_idoso_inexistente_retorna_404(client: TestClient) -> None:
    ana_id = _cadastrar_e_logar(client, "Ana", "ana@example.com")

    resposta = client.delete(f"/idosos/999999/cuidadores/{ana_id}")

    assert resposta.status_code == 404


def test_desvincular_cuidador_nao_vinculado_retorna_404(client: TestClient) -> None:
    _cadastrar_e_logar(client, "Ana", "ana@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Maria", "data_nascimento": "1950-01-01"}
    ).json()
    beto_id = _cadastrar_e_logar(client, "Beto", "beto@example.com")

    _logar(client, "ana@example.com")
    resposta = client.delete(f"/idosos/{idoso['id']}/cuidadores/{beto_id}")

    assert resposta.status_code == 404
