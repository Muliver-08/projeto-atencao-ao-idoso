from datetime import date, datetime, time, timedelta

from fastapi.testclient import TestClient

from app.models.medicamento import calcular_horario_previsto


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


def _criar_idoso_cuidador_medicamento_vinculado(client: TestClient) -> dict:
    cuidador_id = _cadastrar_e_logar(client, "Cuidador Dose", "cuidador.dose@example.com")
    idoso = client.post(
        "/idosos", json={"nome": "Idoso Dose", "data_nascimento": "1950-01-01"}
    ).json()
    medicamento = client.post(
        f"/idosos/{idoso['id']}/medicamentos",
        json={
            "nome": "Med Dose",
            "principio_ativo": "ativodose",
            "dosagem": "10mg",
            "horario": "08:00:00",
            "frequencia_horas": 8,
        },
    ).json()["medicamento"]
    return {
        "idoso_id": idoso["id"],
        "cuidador_id": cuidador_id,
        "medicamento_id": medicamento["id"],
    }


def test_confirmar_dose_sem_cuidador_selecionado_retorna_401(client: TestClient) -> None:
    contexto = _criar_idoso_cuidador_medicamento_vinculado(client)
    # remove a sessão criando um client novo sem cookies
    client_sem_sessao = TestClient(client.app)
    resposta = client_sem_sessao.post(
        f"/medicamentos/{contexto['medicamento_id']}/doses", json={}
    )
    assert resposta.status_code == 401


def test_confirmar_dose_sem_vinculo_retorna_403(client: TestClient) -> None:
    contexto = _criar_idoso_cuidador_medicamento_vinculado(client)
    _cadastrar_e_logar(client, "Outro Cuidador Dose", "outro.dose@example.com")

    resposta = client.post(f"/medicamentos/{contexto['medicamento_id']}/doses", json={})

    assert resposta.status_code == 403


def test_confirmar_dose_com_sucesso(client: TestClient) -> None:
    contexto = _criar_idoso_cuidador_medicamento_vinculado(client)

    resposta = client.post(
        f"/medicamentos/{contexto['medicamento_id']}/doses",
        json={"observacao": "tomou com água"},
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["cuidador"]["nome"] == "Cuidador Dose"
    assert corpo["observacao"] == "tomou com água"


def test_confirmar_mesma_dose_duas_vezes_retorna_409(client: TestClient) -> None:
    contexto = _criar_idoso_cuidador_medicamento_vinculado(client)

    client.post(f"/medicamentos/{contexto['medicamento_id']}/doses", json={})
    resposta = client.post(f"/medicamentos/{contexto['medicamento_id']}/doses", json={})

    assert resposta.status_code == 409
    assert "confirmado_por" in resposta.json()["detail"]


def test_listar_doses_retorna_historico(client: TestClient) -> None:
    contexto = _criar_idoso_cuidador_medicamento_vinculado(client)
    client.post(f"/medicamentos/{contexto['medicamento_id']}/doses", json={})

    resposta = client.get(f"/idosos/{contexto['idoso_id']}/doses")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert len(corpo) == 1
    assert corpo[0]["medicamento_id"] == contexto["medicamento_id"]


def test_calcular_horario_previsto_recua_ancora_futura() -> None:
    agora = datetime.combine(date(2026, 1, 1), time(7, 0))
    previsto = calcular_horario_previsto(time(8, 0), 8, agora)
    # ancora recua p/ 2025-12-31 08:00; 23h decorridas, passos de 8h -> +16h
    assert previsto == datetime.combine(date(2026, 1, 1), time(0, 0))


def test_calcular_horario_previsto_avanca_por_multiplos_da_frequencia() -> None:
    agora = datetime.combine(date(2026, 1, 1), time(23, 30))
    previsto = calcular_horario_previsto(time(8, 0), 8, agora)
    assert previsto == datetime.combine(date(2026, 1, 1), time(16, 0))
    assert agora - previsto < timedelta(hours=8)
