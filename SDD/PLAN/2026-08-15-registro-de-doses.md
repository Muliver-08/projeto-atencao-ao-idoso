# Registro de Doses — Implementation Plan

## Overview
Permitir que um cuidador confirme a administração de uma dose de um medicamento, com bloqueio de dose duplicada (se outro cuidador já confirmou, informa quem e quando), exigência de vínculo com o idoso, indicador visual de atraso e histórico imutável visível a todos os cuidadores. É a segunda e última parte do núcleo diferencial do produto (a primeira foi interação medicamentosa), resolvendo diretamente "vários cuidadores, ninguém sabe com certeza o que já foi dado".

## Scope
### In Scope
- RF10, RF11, RF12, RF13
- RN13, RN14, RN15, RN16, RN17, RN18, RN19, RN20

### Out of Scope
- RN02 (restringir visualização a cuidadores vinculados)
- Edição/remoção de um registro de dose já confirmado (RN20 — histórico imutável)
- Fila/agenda de doses futuras — só a dose pendente atual é exposta
- Notificações/lembretes proativos de atraso

## Current State (from codebase)
- Feature anterior (medicamentos + interação) 100% concluída — `SDD/PLAN/2026-08-15-cadastro-medicamentos-interacao.md`
- `backend/app/models/medicamento.py` — `Medicamento` com `horario` (time) e `frequencia_horas` (int), sem nenhum campo computado ainda
- `backend/app/models/cuidador.py:8-15` — tabela `idoso_cuidador`, fonte de verdade pro vínculo (RN13)
- `backend/app/routers/sessao.py:19-20` — `get_cuidador_atual_id`, hoje `int | None` em todo endpoint existente (nenhum exige não-nulo)
- `backend/migrations/versions/e09521b3d190_*.py` — última migration aplicada (medicamentos + interacoes_medicamentosas)
- `frontend/src/pages/IdosoDetalhe.tsx` — já lista medicamentos ativos numa `Table`, com botão de remover por linha; não tem nenhuma noção de "dose"
- `frontend/src/components/ConfirmarInteracaoDialog.tsx` — padrão de modal já validado (shadcn `Dialog`)

## Desired End State
- Cada medicamento ativo na tela do idoso mostra o próximo horário previsto e fica marcado visualmente quando está atrasado (mais de 30 min do previsto).
- Um botão "Confirmar dose" por medicamento abre um modal com observação opcional; ao confirmar, a dose entra no histórico do idoso.
- Confirmar a mesma dose duas vezes é bloqueado com mensagem mostrando quem já confirmou e quando.
- Confirmar dose sem cuidador selecionado no seletor do topo, ou com um cuidador não vinculado àquele idoso, é bloqueado com mensagem legível.
- Existe uma seção de histórico de doses do idoso, só leitura, visível sempre que a tela é aberta.
- `pytest` cobre sucesso, bloqueio por falta de cuidador/vínculo, duplicata e listagem do histórico.

## References
- PRD: `SDD/PRDs/2026-08-15-registro-de-doses.md`
- Spec: `SDD/SPEC/2026-08-15-registro-de-doses.md`
- Key code references:
  - `backend/app/models/idoso.py:29-38` — padrão de `@property` computado, a seguir pra `proximo_horario_previsto`/`atrasado`
  - `backend/app/services/medicamento_service.py:64-69` — `obter_medicamento`, reusado pra validar o medicamento antes de confirmar dose
  - `backend/app/routers/medicamentos.py:19-58` — padrão de 409 estruturado (`detail` como objeto), reusado pra RN15
  - `frontend/src/pages/IdosoDetalhe.tsx` — `extrairMensagemErro` já trata `detail` objeto, reusar sem modificar a função
- Decisões fechadas nesta sessão (ver PRD seção 10 para detalhe):
  - RN13 é a primeira regra do projeto a exigir `cuidador_atual_id` não-nulo + vínculo validado
  - `horario_previsto` é sempre calculado no backend (âncora `horario` + múltiplos de `frequencia_horas`, mod 24h), nunca enviado pelo cliente
  - Tolerância de atraso: 30 minutos fixo
  - RN15 protegida em duas camadas: checagem em serviço + `UniqueConstraint(medicamento_id, horario_previsto)` no banco
  - Sem fila de doses futuras — só a dose pendente atual (`@property`, não persistida) + histórico das já confirmadas

---

## Phase 1: Model de registro de dose e migration
### Tasks
- [x] Criar `backend/app/models/registro_dose.py` (`RegistroDose` com `UniqueConstraint(medicamento_id, horario_previsto)`)
- [x] Atualizar `backend/migrations/env.py` (importar `registro_dose`)
- [x] Gerar revisão Alembic: `alembic revision --autogenerate -m "create registros_dose table"`
- [x] Revisar o script gerado (sem DROP/ALTER destrutivo; conferir `UniqueConstraint` gerada corretamente)
- [x] Aplicar: `alembic upgrade head`

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run alembic upgrade head` roda sem erro
- [x] `cd backend && uv run alembic revision --autogenerate -m "check"` não detecta diffs pendentes (deletar a revisão vazia gerada pelo check)

#### Manual Verification
- [x] Tabela `registros_dose` existe no banco local, com constraint única em `(medicamento_id, horario_previsto)`

---

## Phase 2: Cálculo de horário previsto e atraso
### Tasks
- [x] Atualizar `backend/app/models/medicamento.py`: constante `TOLERANCIA_ATRASO_MINUTOS`, função `calcular_horario_previsto`, properties `proximo_horario_previsto`/`atrasado` em `Medicamento`
- [x] Atualizar `backend/app/schemas/medicamento.py`: `MedicamentoRead` ganha `proximo_horario_previsto`/`atrasado`
- [x] Criar `backend/app/schemas/registro_dose.py` (`RegistroDoseCreate`, `RegistroDoseRead`)

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run uvicorn app.main:app --reload` sobe sem erro
- [x] `curl http://localhost:8000/idosos/{id}/medicamentos` retorna `proximo_horario_previsto` e `atrasado` em cada item, sem quebrar o schema existente

#### Manual Verification
- [x] Nenhuma (fase é só cálculo/schema, coberta por automação)

---

## Phase 3: Endpoints e regras de negócio de dose
### Tasks
- [x] Criar `backend/app/services/registro_dose_service.py` (`confirmar_dose`, `listar_doses` — RN13, RN15, RN16)
- [x] Criar `backend/app/routers/registros_dose.py` (`POST /medicamentos/{id}/doses`, `GET /idosos/{id}/doses`)
- [x] `include_router(registros_dose.router)` no `main.py`
- [x] Tratamento explícito de exceções (try/except → `HTTPException`, nunca stack trace — RNF03/RNF11)

### Success Criteria
#### Automated Verification
- [x] `curl -X POST http://localhost:8000/medicamentos/{id}/doses` sem sessão de cuidador retorna 401
- [x] Com cuidador selecionado mas não vinculado ao idoso, retorna 403
- [x] Com cuidador vinculado, retorna 201 na primeira confirmação e 409 (com `detail.confirmado_por`) na segunda tentativa da mesma dose
- [x] `curl http://localhost:8000/idosos/{id}/doses` retorna a dose confirmada

#### Manual Verification
- [x] Fluxo completo via `/docs` (Swagger UI): selecionar cuidador → confirmar dose → tentar confirmar de novo (bloqueia) → listar histórico

---

## Phase 4: Testes automatizados (backend)
### Tasks
- [x] Criar `backend/tests/test_registros_dose.py`: sucesso, 401 sem cuidador, 403 sem vínculo, 409 duplicata, listagem de histórico, teste unitário de `calcular_horario_previsto`

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run pytest` — todos os testes passam (novos e das features anteriores)

#### Manual Verification
- Nenhuma (fase cobre apenas testes automatizados)

---

## Phase 5: Frontend — confirmar dose, indicador de atraso e histórico
### Tasks
- [x] Criar `frontend/src/components/ConfirmarDoseDialog.tsx` (observação opcional, RF13)
- [x] Atualizar `frontend/src/pages/IdosoDetalhe.tsx`: coluna de próxima dose + indicador de atraso, botão "Confirmar dose" por medicamento, seção de histórico de doses (só leitura)
- [x] Tratamento de erro (401/403/409) reusando `extrairMensagemErro` já existente na página

### Success Criteria
#### Automated Verification
- [x] `cd frontend && pnpm exec tsc --noEmit` sem erros
- [x] `cd frontend && pnpm build` completa sem erro

#### Manual Verification
- [x] Com backend rodando e um cuidador selecionado no seletor do topo: confirmar dose de um medicamento funciona e aparece no histórico
- [x] Tentar confirmar a mesma dose de novo mostra mensagem legível com quem já confirmou
- [x] Trocar pra um cuidador não vinculado ao idoso e tentar confirmar mostra mensagem legível de bloqueio
- [x] Medicamento com horário previsto vencido há mais de 30 min aparece marcado como atrasado

---

## Phase 6: Verificação end-to-end
### Tasks
- [x] Rodar backend e frontend simultaneamente, percorrer os critérios de aceitação do PRD (seção 9) um a um

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run pytest` — passa
- [x] `cd frontend && pnpm exec tsc --noEmit && pnpm build` — passa

#### Manual Verification
- [x] Todos os itens da seção "Critérios de aceitação" do PRD confirmados manualmente

---

## Testing Notes
- Unit/integration tests: pytest + `TestClient` (backend), cobrindo `registros_dose` — reusa fixtures `db`/`client` de `backend/tests/conftest.py`
- Frontend: sem testes automatizados (mesma decisão das features anteriores)
- Manual steps: 1) subir backend 2) subir frontend 3) selecionar cuidador vinculado ao idoso 4) confirmar dose 5) tentar duplicar 6) trocar cuidador não vinculado e tentar confirmar 7) conferir histórico e indicador de atraso

## Migration Notes
- Projeto usa **Alembic**. Uma migration nesta feature: criação de `registros_dose` (com `UniqueConstraint`). Nenhuma migration na Phase 2 — `proximo_horario_previsto`/`atrasado` são `@property`, não colunas.
- Alterar model → `alembic revision --autogenerate -m "..."` → revisar script (atenção à `UniqueConstraint`) → `alembic upgrade head` → commitar model + revisão juntos.

## Rollout Notes
- Sem deploy nesta feature (mesma decisão das features anteriores).
