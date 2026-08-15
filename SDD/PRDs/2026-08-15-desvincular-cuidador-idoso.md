# PRD — Desvincular Cuidador de Idoso

## 1) Objetivo
- Permitir que um cuidador se desvincule de um idoso, e que o cuidador "dono" (quem cadastrou o idoso) também possa desvincular outros cuidadores — com o evento sempre registrado no histórico do idoso.
- Hoje qualquer cuidador vinculado tem os mesmos direitos e não existe nenhuma forma de sair de um vínculo ou remover outro cuidador; a lista de cuidadores na tela do idoso é somente leitura. Isso trava correções (cuidador adicionado por engano, cuidador que não atende mais o idoso) e não deixa rastro de quem saiu/removeu.

## 2) Escopo
**Inclui**
- Endpoint para o cuidador logado se autodesvincular de um idoso.
- Endpoint para o cuidador "dono" do idoso (`Idoso.criado_por_cuidador_id`) desvincular outro cuidador.
- Regra de transferência de posse: se o dono se desvincula e existe outro cuidador vinculado, a posse (`criado_por_cuidador_id`) passa para o cuidador vinculado há mais tempo em seguida ao dono (por `idoso_cuidador.vinculado_em` ascendente).
- Regra de "idoso órfão": se o dono se desvincula e não há mais ninguém vinculado, o idoso fica sem cuidadores (permitido, apenas para essa saída do dono).
- Bloqueio: um cuidador não-dono não pode se desvincular se essa ação deixar o idoso com zero cuidadores vinculados.
- Registro do evento de desvinculação em histórico, exibido junto ao histórico de doses já existente (`Historico.tsx`), de forma imutável.
- UI: ação de "sair" para o cuidador comum e ação de "remover" por cuidador, visível só para o dono, na aba "Cuidadores" (`AbaCuidadores`, em `frontend/src/routes/idosos.$id.tsx`).

**Não inclui (fora de escopo)**
- Reatribuição manual de posse pelo dono (escolher quem vira o novo dono) — a transferência é automática pelo critério de antiguidade de vínculo.
- Qualquer alteração no fluxo de convite (`convites.py`/`convite_service.py`) — só leitura/consumo do vínculo que ele cria.
- Notificação (email/push) ao cuidador removido ou ao idoso órfão.
- Reversão/desfazer de uma desvinculação.

## 3) Fluxo atual (como funciona hoje)
- Vínculo cuidador↔idoso é uma tabela de associação pura (`idoso_cuidador`, PK composta `idoso_id`+`cuidador_id`), sem soft-delete nem histórico de remoções — `backend/app/models/cuidador.py`.
- Vínculo é criado de duas formas:
  - Ao cadastrar o idoso, o criador é inserido automaticamente como cuidador vinculado (`idoso_service.criar_idoso`, `backend/app/services/idoso_service.py:10-30`).
  - Por convite aceito por email (`ConviteVinculo` → `convite_service.aceitar_convite`, `backend/app/services/convite_service.py:80-91`), que faz `INSERT` direto em `idoso_cuidador`.
- `Idoso.criado_por_cuidador_id` (`backend/app/models/idoso.py:18-20`) já guarda quem criou o cadastro, mas **nenhum endpoint hoje usa esse campo para diferenciar permissões** — todo cuidador vinculado é tratado igual (ex.: `idoso_service.obter_idoso` só checa se o `cuidador_id` está em `idoso.cuidadores`, sem checar se é o dono).
- Não existe nenhum endpoint de remoção de vínculo (`DELETE`) em `idosos.py`, `cuidadores.py` ou `convites.py`.
- Frontend: `AbaCuidadores` (`frontend/src/routes/idosos.$id.tsx:511-585`) lista `idoso.cuidadores` em cards somente leitura (nome + telefone); não há botão de sair/remover.
- Histórico hoje é exclusivamente de doses: `Historico.tsx` (`frontend/src/components/historico.tsx`) renderiza só a lista de `Dose` vinda de `GET /idosos/{id}/doses`; não existe nenhuma tabela/mecanismo de log genérico de eventos no backend (o único registro imutável existente é `RegistroDose`).

## 4) Fluxo desejado (comportamento esperado)
1. Na aba "Cuidadores" do idoso, cada cuidador vinculado que não seja o cuidador logado mostra uma ação:
   - Se o cuidador logado é o dono do idoso: botão "Remover" em cada outro cuidador da lista.
   - Se o cuidador logado não é o dono: apenas uma ação "Sair deste idoso" para si mesmo (não pode remover terceiros).
2. Ao confirmar a remoção/saída:
   - **Dono se desvinculando**: remove o vínculo do dono. Se existir outro cuidador vinculado, a posse passa automaticamente para o cuidador vinculado mais antigo entre os remanescentes (por `vinculado_em`). Se não existir mais ninguém, o idoso fica sem cuidadores (órfão) — permitido.
   - **Dono removendo outro cuidador**: remove o vínculo do cuidador-alvo; a posse não muda.
   - **Cuidador comum se desvinculando**: remove o próprio vínculo, **exceto** se ele for o único cuidador restante vinculado ao idoso — nesse caso a ação é bloqueada com mensagem explicando que não é possível deixar o idoso sem nenhum cuidador.
3. Toda desvinculação bem-sucedida gera uma entrada de histórico imutável (quem saiu/foi removido, por quem — quando aplicável —, e quando), exibida junto com o histórico de doses do idoso, ordenada cronologicamente com os demais eventos.
4. Erros (tentar remover sem ser dono, tentar sair sendo o último cuidador, idoso/cuidador inexistente) aparecem como mensagem compreensível na UI (RNF03/RNF05), nunca stack trace ou tela branca.

## 5) Mapa do Codebase (onde isso vive)

### 5.1 Entradas (rotas/telas/handlers)
- `backend/app/routers/idosos.py` — routers de idoso; provável local de um novo `DELETE /idosos/{idoso_id}/cuidadores/{cuidador_id}` (padrão análogo a `convites.py`, que já injeta `get_cuidador_atual_id` e trata `HTTPException`/erro genérico).
- `frontend/src/routes/idosos.$id.tsx` — `AbaCuidadores` (linhas 511-585) precisa passar a receber `cuidadorAtual` (hoje só recebe `idoso` e `aoConvidar`) para decidir qual ação mostrar em cada card.

### 5.2 Domínio / Regras / Serviços
- Não existe `vinculo_service.py`. Padrão de referência mais próximo: `backend/app/services/convite_service.py`, que já tem `_validar_vinculo(db, idoso_id, cuidador_id)` (checa presença em `idoso_cuidador`) e manipula `idoso_cuidador` via `insert().values(...)` dentro de uma `Session` síncrona com `db.commit()` explícito.
- `backend/app/services/idoso_service.py::obter_idoso` mostra o padrão atual de checagem de vínculo (retorna 404 se não vinculado, não 403) — não diferencia dono.

### 5.3 Persistência / Modelos / Migrações
- `idoso_cuidador` (`backend/app/models/cuidador.py:8-15`) — tabela de associação, PK composta `(idoso_id, cuidador_id)`, colunas `vinculado_em`, `vinculado_por_cuidador_id`. **Sem coluna de soft-delete**; um `DELETE` físico da linha é o único jeito de "desvincular" hoje.
- `Idoso.criado_por_cuidador_id` (`backend/app/models/idoso.py:18-20`) — campo já existente que serve como "dono"; a transferência de posse (item 4.2) exigirá um `UPDATE` nesse campo.
- **Não existe tabela de histórico/auditoria genérica.** O único padrão de "evento imutável" no sistema é `RegistroDose` (`backend/app/models/registro_dose.py`), específico de confirmação de dose (`medicamento_id`, `cuidador_id`, `horario_previsto`, `confirmado_em`, `observacao`). Uma tabela nova (ex. algo como `historico_vinculo`, decisão de schema fica para a fase de Spec) será necessária para registrar o evento de desvinculação, já que a linha de `idoso_cuidador` é apagada e não pode servir de registro histórico sozinha.
- **Migrations**: Alembic, `backend/migrations/versions/`. Nenhuma migration hoje toca soft-delete ou histórico de `idoso_cuidador`. A migration mais recente da tabela é `57c204bc42db_create_idosos_cuidadores_tables.py` (cria `idoso_cuidador` original). Qualquer nova tabela/coluna precisará de migration própria.

### 5.4 Integrações externas (clients/adapters/providers)
- Nenhuma.

### 5.5 UI / Componentes
- `frontend/src/routes/idosos.$id.tsx` — `AbaCuidadores` (cards de cuidador) precisará de botão de ação condicional (dono vê "Remover" nos outros, não-dono vê "Sair" só no próprio card).
- `frontend/src/components/historico.tsx` — `Historico` hoje só aceita `doses: Dose[]` e `medicamentos: Medicamento[]`; para exibir eventos de desvinculação juntos, vai precisar aceitar/mesclar um segundo tipo de evento e renderizar timeline unificada ordenada por data.
- `frontend/src/lib/api.ts` — não tem método de remoção de vínculo; endpoints existentes seguem o padrão `chamar(real, exemplo)` com fallback para modo demo (`frontend/src/lib/dados-exemplo.ts`, não lido por completo).
- `frontend/src/lib/tipos.ts` — não tem tipo para evento de vínculo/histórico administrativo.

### 5.6 Testes / Fixtures
- `backend/tests/test_convites.py`, `backend/tests/test_idosos.py` — testes existentes cobrem criação/aceite de vínculo; nenhum teste cobre remoção de vínculo hoje. `backend/tests/conftest.py` tem as fixtures reutilizáveis (`client`, `db`, provavelmente helpers de criar idoso/cuidador — não lido por completo).

## 6) Padrões existentes para reuso (evitar duplicação)
- `backend/app/services/convite_service.py::_validar_vinculo` — checagem "cuidador X está vinculado ao idoso Y", reaproveitável tal qual para validar quem pode se autodesvincular.
- `backend/app/routers/convites.py` — padrão de router: `Depends(get_cuidador_atual_id)`, `if cuidador_atual_id is None: raise HTTPException(401, ...)`, `try/except HTTPException: raise / except Exception: raise HTTPException(500, "mensagem legível")`. Seguir o mesmo formato para o(s) novo(s) endpoint(s).
- `backend/app/services/idoso_service.py::criar_idoso` e `convite_service.py::aceitar_convite` — padrão de manipular `idoso_cuidador` via Core (`db.execute(idoso_cuidador.insert().values(...))`); a remoção deve usar `idoso_cuidador.delete().where(...)` no mesmo estilo (ver §7).
- `backend/app/models/medicamento.py` (`Medicamento.ativo`) + `backend/app/services/medicamento_service.py::inativar_medicamento` — padrão de soft delete preservando histórico (RN06); referência de estilo, ainda que não aplicável diretamente à tabela de associação `idoso_cuidador`.
- `backend/app/models/registro_dose.py` (`RegistroDose`) — único modelo de "evento imutável" existente; referência de forma (campos: quem, quando, o quê) para desenhar a futura tabela de histórico de vínculo.
- `frontend/src/routes/idosos.$id.tsx` — `useCuidador()` (`frontend/src/lib/cuidador-contexto.tsx`, não lido por completo) já dá acesso ao `cuidadorAtual` na página; `AbaMedicamentos` já mostra o padrão de passar `cuidadorAtual` para um componente de aba condicionar UI (usado para desabilitar confirmação de dose sem login).

## 7) Documentação externa (via Context7)

### Consultas realizadas
| Library ID | Query | Resumo do resultado |
|------------|-------|---------------------|
| `/websites/sqlalchemy_en_20_core` | "delete a row from a many-to-many association table using a Core Table object (Table.delete() / delete() construct with where clause)" | Confirma o padrão `table.delete().where(table.c.id == 7)` / `delete(table).where(...)` do SQLAlchemy Core 2.0 — mesmo estilo já usado no projeto (`idoso_cuidador.insert().values(...)`) pode ser espelhado com `idoso_cuidador.delete().where(...)` para remover o vínculo. |

### Trechos relevantes
- **SQLAlchemy Core — delete com where**:
  ```python
  from sqlalchemy import delete
  stmt = delete(idoso_cuidador).where(
      idoso_cuidador.c.idoso_id == idoso_id,
      idoso_cuidador.c.cuidador_id == cuidador_id,
  )
  db.execute(stmt)
  ```

## 8) Impactos prováveis (áreas afetadas)
- **Backend — modelos/migração**: nova tabela (ou extensão) para registrar o evento de desvinculação de forma imutável, já que `idoso_cuidador` não guarda histórico e a linha some com o `DELETE`. Precisa de migration Alembic.
- **Backend — schema/permissão**: `IdosoRead` hoje não expõe `criado_por_cuidador_id` (`backend/app/schemas/idoso.py`); o frontend precisa saber quem é o dono para decidir qual ação mostrar, então o schema de leitura do idoso (ou de cada cuidador na lista) provavelmente precisa expor essa informação.
- **Backend — serviço/router**: novo serviço (ex. `vinculo_service.py`, nome definido na Spec) com as regras de autodesvinculação, remoção pelo dono, transferência de posse e bloqueio de "último cuidador"; novo(s) endpoint(s) em `idosos.py` ou `cuidadores.py`.
- **Frontend — API client**: novo método em `api.ts` (padrão `chamar(real, exemplo)`) e espelho no modo demo (`dados-exemplo.ts`).
- **Frontend — UI**: `AbaCuidadores` ganha ações condicionais (dono vs. comum); `Historico.tsx` passa a mesclar dois tipos de evento (dose + vínculo) numa timeline única.
- **Testes**: novos testes de backend cobrindo autodesvinculação, remoção pelo dono, transferência de posse, bloqueio de idoso "órfão" indevido e o registro no histórico.

## 9) Critérios de aceitação
- [ ] Um cuidador vinculado a um idoso consegue se desvincular por conta própria.
- [ ] O cuidador dono do idoso consegue desvincular qualquer outro cuidador vinculado a esse idoso.
- [ ] Um cuidador não-dono não consegue desvincular outro cuidador (só a si mesmo).
- [ ] Se o dono se desvincula e há outro cuidador vinculado, a posse do idoso passa automaticamente para o cuidador vinculado há mais tempo entre os remanescentes.
- [ ] Se o dono se desvincula e não há mais ninguém vinculado, o idoso fica sem cuidadores (permitido).
- [ ] Um cuidador não-dono não consegue se desvincular se isso deixar o idoso com zero cuidadores vinculados (ação bloqueada com mensagem clara).
- [ ] Toda desvinculação (saída ou remoção) gera uma entrada no histórico do idoso, visível a quem ainda estiver vinculado.
- [ ] O histórico é imutável — a entrada de desvinculação não pode ser editada ou apagada pela UI.
- [ ] Erros (sem permissão, idoso/cuidador inexistente, tentativa de deixar o idoso sem cuidadores) aparecem como mensagem legível, nunca stack trace ou tela branca.

## 10) Open Questions (bloqueios / dúvidas)
- **Desenho da tabela de histórico de vínculo**: criar uma tabela nova dedicada (ex. `historico_vinculo` com `idoso_id`, `cuidador_id`, `tipo_evento`, `realizado_por_cuidador_id`, `criado_em`) ou generalizar para um log de eventos do idoso que também poderia acomodar futuros tipos de evento? Fica para a fase de Plan/Spec decidir o schema exato.
- **Critério de desempate na transferência de posse**: "vinculado mais antigo em seguida ao dono" está definido por `idoso_cuidador.vinculado_em` ascendente — confirmar que não há cenário de empate relevante (ex. dois cuidadores vinculados no mesmo instante) a tratar.
- **Exposição de `criado_por_cuidador_id`**: confirmar se o frontend deve receber o id do dono bruto em `IdosoRead`, ou se cada `CuidadorRead` na lista deveria ganhar um flag calculado (ex. `eh_dono: bool`) — mais simples de consumir na UI e evita expor lógica de comparação de IDs no cliente.
- **Nome exato do(s) endpoint(s)**: um único `DELETE /idosos/{idoso_id}/cuidadores/{cuidador_id}` cobrindo tanto autodesvinculação quanto remoção pelo dono (diferenciando por quem está logado), ou dois endpoints separados (`DELETE /idosos/{idoso_id}/cuidadores/me` e `DELETE /idosos/{idoso_id}/cuidadores/{cuidador_id}`)? Fica para a Spec.
