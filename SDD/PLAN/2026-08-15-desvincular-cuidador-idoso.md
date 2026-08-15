PLAN PATH: SDD/PLAN/2026-08-15-desvincular-cuidador-idoso.md

# Desvincular Cuidador de Idoso — Implementation Plan

## Overview
Hoje um cuidador vinculado a um idoso não tem como sair desse vínculo, e não existe nenhum papel de "dono"/administrador — todos os cuidadores vinculados têm os mesmos direitos e a lista de cuidadores na tela do idoso é só leitura. Vamos implementar: (1) qualquer cuidador vinculado pode se autodesvincular de um idoso; (2) o cuidador que cadastrou o idoso ("dono", `Idoso.criado_por_cuidador_id`) pode desvincular outros cuidadores; (3) toda desvinculação gera um evento imutável no histórico do idoso, exibido junto do histórico de doses já existente.

## Scope
### In Scope
- Novo endpoint `DELETE /idosos/{idoso_id}/cuidadores/{cuidador_id}` (autodesvinculação quando `cuidador_id` é o próprio cuidador logado; remoção de terceiro só se o cuidador logado for o dono do idoso).
- Regra de transferência de posse: dono saindo com outro cuidador vinculado transfere `criado_por_cuidador_id` para o cuidador vinculado há mais tempo entre os remanescentes (`idoso_cuidador.vinculado_em` ASC, desempate por `cuidador_id` ASC).
- Regra de idoso órfão: dono saindo sozinho (sem outro cuidador vinculado) deixa `criado_por_cuidador_id = NULL`.
- Bloqueio: cuidador não-dono não pode se desvincular se isso deixar o idoso com zero cuidadores vinculados.
- Nova tabela `historico_vinculo` (evento imutável: quem saiu/foi removido, tipo de evento, quem executou quando aplicável, quando).
- Novo endpoint `GET /idosos/{idoso_id}/historico-vinculo`.
- Campo `eh_dono: bool` calculado em cada cuidador retornado dentro de `IdosoRead.cuidadores`.
- UI: ação "Sair" (cuidador comum, no próprio card) e "Remover" (dono, nos cards dos outros) na aba Cuidadores; histórico do idoso passa a mesclar doses + eventos de vínculo numa única timeline ordenada por data.

### Out of Scope
- Reatribuição manual de posse pelo dono (escolha de quem vira o novo dono).
- Qualquer alteração no fluxo de convite (`convites.py`, `convite_service.py`, `ConviteVinculo`).
- Notificação (email/push) ao cuidador removido ou sobre idoso órfão.
- Desfazer/reverter uma desvinculação.

## Current State (from codebase)
- `backend/app/models/cuidador.py:8-15` — `idoso_cuidador`, tabela de associação pura (PK composta `idoso_id`+`cuidador_id`), sem soft-delete, com `vinculado_em` e `vinculado_por_cuidador_id`.
- `backend/app/models/idoso.py:18-20` — `Idoso.criado_por_cuidador_id` já existe, mas nenhum endpoint hoje o usa para diferenciar permissão.
- `backend/app/services/idoso_service.py:43-47` — `obter_idoso` já é o guard de "cuidador está vinculado?" (404 se não), padrão a reaproveitar.
- `backend/app/services/convite_service.py:12-23` — `_validar_vinculo`, padrão de checagem de vínculo reaproveitável.
- `backend/app/routers/idosos.py`, `backend/app/routers/convites.py`, `backend/app/routers/medicamentos.py:102-112` — padrão de router: `Depends(get_cuidador_atual_id)`, `401` se não logado, `try/except HTTPException: raise / except Exception: raise HTTPException(500, "mensagem legível")`, `DELETE` retorna `Response(status_code=204)`.
- `backend/app/schemas/idoso.py:21-29` — `IdosoRead.cuidadores: list[CuidadorRead]`, sem indicação de dono.
- `backend/migrations/env.py:10` e `backend/tests/conftest.py:13` — listas explícitas de import de modelos para registrar em `Base.metadata`; um modelo novo precisa ser adicionado nas duas.
- `frontend/src/routes/idosos.$id.tsx:511-585` — `AbaCuidadores`, hoje só lista cuidadores (cards somente leitura), sem receber `cuidadorAtual`.
- `frontend/src/components/historico.tsx` — aceita só `Dose[]`, sem suporte a outro tipo de evento.
- `frontend/src/lib/api.ts`, `frontend/src/lib/tipos.ts`, `frontend/src/lib/dados-exemplo.ts` — padrão `chamar(real, exemplo)` com fallback de modo demo para cada endpoint.

## Desired End State
- Na aba "Cuidadores" de um idoso: o cuidador logado vê "Sair deste idoso" no próprio card; se ele for o dono, vê "Remover" nos cards dos demais cuidadores.
- Sair/remover funciona nos casos permitidos e é bloqueado (com mensagem clara) quando um não-dono tentaria deixar o idoso sem nenhum cuidador.
- Dono saindo com outro cuidador presente transfere a posse automaticamente; dono saindo sozinho deixa o idoso sem dono.
- A aba "Histórico" do idoso mostra, na mesma lista cronológica, as confirmações de dose e os eventos de entrada/saída de cuidador, sem opção de editar ou apagar.

## References
- PRD: `SDD/PRDs/2026-08-15-desvincular-cuidador-idoso.md`
- Spec: `SDD/SPEC/2026-08-15-desvincular-cuidador-idoso.md`
- Key code references:
  - `backend/app/models/cuidador.py:8-15` — tabela `idoso_cuidador`
  - `backend/app/models/idoso.py:18-20` — `criado_por_cuidador_id`
  - `backend/app/services/convite_service.py:12-23` — padrão `_validar_vinculo`
  - `backend/app/routers/medicamentos.py:102-112` — padrão de endpoint `DELETE`
  - `frontend/src/routes/idosos.$id.tsx:511-585` — `AbaCuidadores`
  - `frontend/src/components/historico.tsx` — `Historico`

---

## Phase 1: Modelo, schema e migration
### Tasks
- [x] Criar `backend/app/models/historico_vinculo.py` com `TipoEventoVinculo` (enum `SAIU`/`REMOVIDO`) e `HistoricoVinculo` (`id`, `idoso_id`, `cuidador_id`, `tipo_evento`, `realizado_por_cuidador_id` nullable, `criado_em`).
- [x] Adicionar `historico_vinculo` aos imports de registro de metadata em `backend/migrations/env.py:10` e `backend/tests/conftest.py:13`.
- [x] Criar `backend/app/schemas/historico_vinculo.py` (`HistoricoVinculoRead`).
- [x] Adicionar `CuidadorVinculado(CuidadorRead)` com `eh_dono: bool` em `backend/app/schemas/cuidador.py`, e trocar `IdosoRead.cuidadores` para `list[CuidadorVinculado]` em `backend/app/schemas/idoso.py`.
- [x] Gerar migration Alembic (`uv run alembic revision --autogenerate -m "create historico_vinculo table"`), revisar o script gerado, aplicar localmente.

### Success Criteria
#### Automated Verification
- [x] `uv run alembic upgrade head` roda sem erro
- [x] `uv run pytest backend/tests/conftest.py` (setup de schema) não quebra — rodar `uv run pytest` completo passa (mesmo sem testes novos ainda)

#### Manual Verification
- [ ] Revisar o script de migration gerado: sem `DROP`/`ALTER` destrutivo, só `CREATE TABLE historico_vinculo`

---

## Phase 2: Regra de negócio (serviço de vínculo)
### Tasks
- [x] Criar `backend/app/services/vinculo_service.py` com `desvincular_cuidador(db, idoso_id, cuidador_alvo_id, cuidador_atual_id) -> None`:
  - 404 se idoso não existe
  - valida que `cuidador_atual_id` está vinculado ao idoso (reaproveita padrão de `_validar_vinculo`)
  - se `cuidador_alvo_id != cuidador_atual_id`: 403 a menos que `cuidador_atual_id == idoso.criado_por_cuidador_id`
  - 404 se `cuidador_alvo_id` não está vinculado ao idoso
  - se `cuidador_alvo_id` é o dono (autodesvinculação do dono): calcula remanescentes; se houver, transfere `criado_por_cuidador_id` para o de `vinculado_em` mais antigo (desempate por `cuidador_id`); se não houver, seta `criado_por_cuidador_id = None`
  - se `cuidador_alvo_id` não é o dono e é autodesvinculação: bloqueia com 400/409 se remover deixaria o idoso com zero cuidadores
  - remove a linha de `idoso_cuidador` (`idoso_cuidador.delete().where(...)`)
  - insere `HistoricoVinculo` (`tipo_evento=SAIU` se autodesvinculação, `REMOVIDO` caso contrário; `realizado_por_cuidador_id=None` se autodesvinculação, senão `cuidador_atual_id`)
  - `db.commit()`
- [x] Adicionar `listar_historico_vinculo(db, idoso_id) -> list[HistoricoVinculo]` (ordenado por `criado_em desc`, mesmo padrão de `registro_dose_service.listar_doses`).
- [x] Atualizar `idoso_service.obter_idoso` e `idoso_service.listar_idosos` para retornar `IdosoRead`/`list[IdosoRead]` já com `eh_dono` calculado por cuidador (em vez de devolver o ORM `Idoso` cru para o `response_model` converter sozinho).

### Success Criteria
#### Automated Verification
- [x] Testes novos de `backend/tests/test_vinculo.py` (Phase 3) passam

#### Manual Verification
- [ ] Revisão de código confirma que nenhuma branch deixa o idoso com `criado_por_cuidador_id` apontando para um cuidador não mais vinculado

---

## Phase 3: Endpoints e testes de backend
### Tasks
- [x] Adicionar `DELETE /idosos/{idoso_id}/cuidadores/{cuidador_id}` em `backend/app/routers/idosos.py` (status 204, padrão try/except já usado nos outros endpoints do arquivo).
- [x] Adicionar `GET /idosos/{idoso_id}/historico-vinculo` (response_model `list[HistoricoVinculoRead]`), mesmo arquivo ou `backend/app/routers/historico_vinculo.py`, seguindo o padrão de `registros_dose.py:35-51` (chama `idoso_service.obter_idoso` antes, pra validar vínculo).
- [x] Criar `backend/tests/test_vinculo.py` cobrindo os 9 critérios de aceitação do PRD (ver Testing Notes).

### Success Criteria
#### Automated Verification
- [x] `uv run pytest` passa (suíte completa, incluindo `test_vinculo.py`)

#### Manual Verification
- [ ] `uv run uvicorn app.main:app --reload` + chamada manual (curl/Swagger `/docs`) do novo `DELETE` confirma 204 no caso feliz e mensagens legíveis nos casos de erro (401/403/404/bloqueio)

---

## Phase 4: Frontend
### Tasks
- [x] `frontend/src/lib/tipos.ts`: `Cuidador.eh_dono?: boolean` (presente quando vem de dentro de `Idoso.cuidadores`), `TipoEventoVinculo`, `EventoVinculo`.
- [x] `frontend/src/lib/api.ts`: `desvincularCuidador(idosoId, cuidadorId)` (`DELETE`) e `listarHistoricoVinculo(idosoId)` (`GET`), seguindo o padrão `chamar(real, exemplo)`.
- [x] `frontend/src/lib/dados-exemplo.ts`: espelhar os dois novos métodos no modo demo (`demo.desvincularCuidador`, `demo.listarHistoricoVinculo`), incluindo `eh_dono` nos cuidadores de exemplo.
- [x] `frontend/src/routes/idosos.$id.tsx`: `AbaCuidadores` passa a receber `cuidadorAtual`; cada card mostra "Sair" (se `c.id === cuidadorAtual?.id`) ou "Remover" (se `cuidadorAtual?.eh_dono` e `c.id !== cuidadorAtual.id`); aba "Histórico" busca também `listarHistoricoVinculo` e passa pra `Historico`.
- [x] `frontend/src/components/historico.tsx`: aceitar lista mesclada de doses + eventos de vínculo, renderizados numa timeline única ordenada por data (`confirmado_em` / `criado_em`).

### Success Criteria
#### Automated Verification
- [x] `npm run lint` sem erros novos
- [x] `npm run build` conclui sem erro de tipo

#### Manual Verification
- [ ] No navegador: cuidador comum vê e usa "Sair"; dono vê e usa "Remover" nos outros; tentativa de deixar idoso sem cuidador é bloqueada com mensagem clara; evento aparece na aba Histórico

---

## Testing Notes
- Unit/integration tests (pytest): autodesvinculação de cuidador comum (sucesso); dono removendo outro cuidador (sucesso); não-dono tentando remover terceiro (403); dono se autodesvinculando com outro cuidador presente (posse transferida ao mais antigo); dono se autodesvinculando sozinho (idoso fica com `criado_por_cuidador_id = None`); não-dono tentando se autodesvincular sendo o único cuidador restante (bloqueado); toda desvinculação bem-sucedida cria linha em `historico_vinculo` com os dados corretos; `GET /idosos/{id}/historico-vinculo` retorna os eventos; idoso/cuidador inexistente retorna 404.
- Manual steps: 1) rodar backend + frontend localmente; 2) criar idoso + 2 cuidadores vinculados; 3) testar sair/remover nos dois papéis pela UI; 4) conferir evento na aba Histórico.

## Migration Notes
- O projeto usa **Alembic** (não Flask-Migrate — ver `CLAUDE.md`).
- Alteração de schema (`CREATE TABLE historico_vinculo`) exige a fase de migration deste plan:
  1. Criar `backend/app/models/historico_vinculo.py`
  2. `uv run alembic revision --autogenerate -m "create historico_vinculo table"` — gera script em `backend/migrations/versions/`
  3. Revisar o script gerado (sem `DROP`/`ALTER` destrutivo)
  4. `uv run alembic upgrade head` — aplica localmente
  5. Commitar model + migration + `env.py`/`conftest.py` atualizados juntos

## Rollout Notes
- Deploy do backend no Render já roda migrations conforme pipeline existente do projeto — nenhuma mudança de infraestrutura necessária para esta feature.
