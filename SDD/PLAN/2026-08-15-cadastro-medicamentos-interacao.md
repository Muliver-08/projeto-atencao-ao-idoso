# Cadastro de Medicamentos e Verificação de Interação — Implementation Plan

## Overview
Permitir que um cuidador cadastre medicamentos para um idoso já existente, com verificação automática de interação de risco contra os medicamentos ativos do mesmo idoso (base curada interna, sem API externa). Interação de risco alto bloqueia e exige confirmação explícita; risco moderado só avisa. É o núcleo diferencial do produto e pré-requisito direto da próxima feature (registro de doses).

## Scope
### In Scope
- RF05, RF06, RF07, RF08, RF09
- RN04, RN05, RN06, RN07, RN08, RN09, RN10, RN11, RN12
- Nova rota de detalhe do idoso (`/idosos/:id`) no frontend, onde mora a lista/form de medicamentos

### Out of Scope
- RF10-RF13 / RN13-RN20 (registro de doses) — próximo ciclo SDD
- RN02 (restringir visualização a cuidadores vinculados)
- Conteúdo real da base de interações (RN08) — seed é placeholder fictício, a ser substituído pela equipe
- Edição da base de interações pela UI (RN12 proíbe explicitamente)

## Current State (from codebase)
- Feature anterior (idoso/cuidadores) 100% concluída — `SDD/PLAN/2026-08-14-cadastro-idoso-cuidadores.md`
- `backend/app/models/idoso.py`, `cuidador.py` — únicos models existentes
- `backend/migrations/versions/57c204bc42db_*.py`, `3350335ecce2_*.py` — histórico Alembic atual
- `backend/app/routers/sessao.py` — `get_cuidador_atual_id` já pronto pra reuso
- `frontend/src/main.tsx` — rotas atuais: `/`, `idosos`, `cuidadores` (sem rota de detalhe)
- `frontend/src/components/ui/` — `button`, `input`, `select`, `card`, `table`, `alert` instalados; `dialog` e `form` não

## Desired End State
- Na tela de detalhe de um idoso (`/idosos/:id`), é possível cadastrar um medicamento e ver a lista dos medicamentos ativos dele.
- Cadastrar um medicamento cujo princípio ativo interage em risco alto com um já ativo abre um modal de confirmação; sem confirmar, nada é salvo.
- Interação moderada aparece como aviso após salvar, sem bloquear.
- Medicamento duplicado (mesmo princípio ativo + dosagem, ativo) é rejeitado com mensagem legível.
- Remover um medicamento não apaga a linha do banco (fica com `ativo=false`, some da lista).
- `pytest` cobre criação, duplicata, interação (alto/moderado/múltipla) e soft delete.

## References
- PRD: `SDD/PRDs/2026-08-15-cadastro-medicamentos-interacao.md`
- Spec: `SDD/SPEC/2026-08-15-cadastro-medicamentos-interacao.md`
- Key code references:
  - `backend/app/routers/idosos.py` — padrão de router a seguir
  - `backend/app/services/cuidador_service.py` — padrão de service com validação de negócio
  - `backend/app/routers/sessao.py:19-20` — `get_cuidador_atual_id`
  - `frontend/src/pages/Cuidadores.tsx` — padrão de form controlado + máscara de input
- Decisões fechadas nesta sessão (ver PRD seção 10 para detalhe):
  - Base curada: seed placeholder fictício (2-3 pares), conteúdo real fica pendente pra equipe
  - RN05: checagem de duplicata só na camada de serviço, sem constraint de banco
  - Horário/frequência: `horario` (time) + `frequencia_horas` (int)
  - Confirmação de risco alto: modal via `dialog` do shadcn (instalar; mesmo risco de indisponibilidade que ocorreu com `form` na feature anterior — se indisponível, cair para `Alert` inline conforme fallback já usado)
  - Tela de medicamentos mora em nova rota de detalhe `/idosos/:id`

---

## Phase 1: Modelos e migrations
### Tasks
- [x] Criar `backend/app/models/interacao.py` (`NivelRisco` enum + `InteracaoMedicamentosa`)
- [x] Criar `backend/app/models/medicamento.py` (`Medicamento`)
- [x] Gerar revisão Alembic: `alembic revision --autogenerate -m "create medicamentos table"`
- [x] Gerar revisão Alembic: `alembic revision --autogenerate -m "create interacoes_medicamentosas table"` (autogenerate juntou as duas tabelas numa única revisão, pois ambos os models eram novos simultaneamente)
- [x] Revisar os dois scripts gerados (sem DROP/ALTER destrutivo; conferir criação do tipo `nivel_risco` enum no Postgres)
- [x] Aplicar: `alembic upgrade head`
- [x] Criar `backend/scripts/seed_interacoes.py` (DML separado da migration, conforme regra do `implementar.md`) e rodar `uv run python scripts/seed_interacoes.py`

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run alembic upgrade head` roda sem erro
- [x] `cd backend && uv run alembic revision --autogenerate -m "check"` não detecta diffs pendentes após o upgrade (deletar a revisão vazia gerada pelo check)

#### Manual Verification
- [x] Tabelas `medicamentos` e `interacoes_medicamentosas` existem no banco local
- [x] `interacoes_medicamentosas` tem as linhas placeholder após rodar o seed script

---

## Phase 2: Endpoints e regras de negócio
### Tasks
- [x] Criar `backend/app/schemas/interacao.py` (`InteracaoRead`)
- [x] Criar `backend/app/schemas/medicamento.py` (`MedicamentoCreate`, `MedicamentoUpdate`, `MedicamentoRead`, `MedicamentoCriado`)
- [x] Criar `backend/app/services/interacao_service.py` (`verificar_interacao` — RN07/RN08/RN11)
- [x] Criar `backend/app/services/medicamento_service.py` (`criar_medicamento`, `listar_medicamentos`, `obter_medicamento`, `atualizar_medicamento`, `inativar_medicamento` — RN04, RN05, RN06)
- [x] Criar `backend/app/routers/medicamentos.py` (`POST/GET /idosos/{idoso_id}/medicamentos`, `PATCH/DELETE /medicamentos/{id}`)
- [x] `include_router(medicamentos.router)` no `main.py`
- [x] Tratamento explícito de exceções (try/except → `HTTPException`, nunca stack trace — RNF03/RNF11)

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run uvicorn app.main:app --reload` sobe sem erro
- [x] `curl -X POST http://localhost:8000/idosos/{id}/medicamentos -d '{...}'` retorna 201 quando não há interação
- [x] Cadastrar 2 medicamentos com princípios ativos configurados como risco alto no seed retorna 409 com payload de interação na primeira tentativa, e 201 ao reenviar com `confirmar_risco_alto: true`
- [x] Cadastrar medicamento duplicado (mesmo princípio ativo + dosagem, ativo) retorna 422

#### Manual Verification
- [x] Fluxo completo via `/docs` (Swagger UI): criar medicamento → interação moderada (aviso, salva) → interação alta (bloqueia, confirma, salva) → duplicata (bloqueia) → remover (some da listagem)

---

## Phase 3: Testes automatizados (backend)
### Tasks
- [x] Criar `backend/tests/test_medicamentos.py`: cria medicamento, valida duplicata bloqueada, valida soft delete (some da listagem, mas segue no banco)
- [x] Criar `backend/tests/test_interacoes.py`: interação alta bloqueia sem confirmação e libera com `confirmar_risco_alto`, interação moderada não bloqueia, múltiplas interações retornam a de maior risco

### Success Criteria
#### Automated Verification
- [x] `cd backend && uv run pytest` — todos os testes passam (novos e os da feature anterior)

#### Manual Verification
- Nenhuma (fase cobre apenas testes automatizados)

---

## Phase 4: Frontend — tela de detalhe do idoso e medicamentos
### Tasks
- [x] Instalar componente shadcn `dialog` (`pnpm dlx shadcn@latest add dialog`); se indisponível no registry `base-nova`, cair para `Alert` inline (mesmo fallback usado quando `form` não existiu na feature anterior) — instalação funcionou, sem necessidade de fallback
- [x] Criar `frontend/src/pages/IdosoDetalhe.tsx` — dados do idoso + cuidadores vinculados (reusa `GET /idosos/{id}`) + lista/form de medicamentos
- [x] Criar `frontend/src/components/ConfirmarInteracaoDialog.tsx` — modal RN09
- [x] Atualizar `frontend/src/main.tsx` — rota `idosos/:id` → `IdosoDetalhe`
- [x] Atualizar `frontend/src/pages/Idosos.tsx` — cada linha da tabela vira link pra `/idosos/:id`
- [x] Campo de horário do medicamento usa input de texto mascarado `HH:MM` (mesmo padrão de UX já aplicado no campo de data — sem exigir clique em segmento específico), não `<input type="time">`
- [x] Tratamento de erro de conexão e validação de formulário (reusar padrão `extrairMensagemErro` de `Cuidadores.tsx`/`Idosos.tsx`)

### Success Criteria
#### Automated Verification
- [x] `cd frontend && pnpm exec tsc --noEmit` sem erros
- [x] `cd frontend && pnpm build` completa sem erro

#### Manual Verification
- [x] Com backend rodando: acessar `/idosos/:id`, cadastrar medicamento sem interação, com interação moderada (aviso) e com interação alta (modal de confirmação) — tudo funcional pela UI
- [x] Tentar cadastrar medicamento duplicado mostra mensagem legível
- [x] Remover medicamento some da lista sem quebrar a tela

---

## Phase 5: Verificação end-to-end
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
- Unit/integration tests: pytest + `TestClient` (backend), cobrindo `medicamentos` e `interacoes` — reusa fixtures `db`/`client` de `backend/tests/conftest.py`
- Frontend: sem testes automatizados (mesma decisão da feature anterior)
- Manual steps: 1) subir backend 2) rodar seed de interações 3) subir frontend 4) percorrer fluxo completo de medicamento + interação pela UI

## Migration Notes
- Projeto usa **Alembic**. Duas migrations nesta feature: criação de `medicamentos` e de `interacoes_medicamentosas`.
- Seed da base curada (placeholder) é **script separado** (`backend/scripts/seed_interacoes.py`), não migration — regra DDL≠DML do `SDD/implementar.md`.
- Alterar model → `alembic revision --autogenerate -m "..."` → revisar script (atenção especial ao tipo enum `nivel_risco` no Postgres) → `alembic upgrade head` → commitar model + revisão juntos.

## Rollout Notes
- Sem deploy nesta feature (mesma decisão da feature anterior).
