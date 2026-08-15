# PRD — Registro de Doses

## 1) Objetivo
- Permitir que um cuidador confirme a administração de uma dose de um medicamento (RF10), com histórico visível a todos os cuidadores vinculados (RF11), indicação visual de atraso (RF12) e observação opcional (RF13).
- É o núcleo diferencial restante do produto: bloqueio de dose duplicada (RN15) resolve o problema central "vários cuidadores, ninguém sabe com certeza o que já foi dado".

## 2) Escopo
**Inclui**
- RF10, RF11, RF12, RF13
- RN13, RN14, RN15, RN16, RN17, RN18, RN19, RN20

**Não inclui (fora de escopo)**
- RN02 (restringir visualização do idoso a cuidadores vinculados) — mesma decisão já tomada na feature de medicamentos, continua fora
- RF14 completo de autenticação — segue apenas o seletor de cuidador já existente (`get_cuidador_atual_id`, sessão sem senha)
- Edição/exclusão de um registro de dose já confirmado (RN20 torna o histórico imutável — não há RF pedindo edição)
- Notificações/lembretes proativos de dose atrasada (RF12 pede apenas indicação visual, não push/e-mail)

## 3) Fluxo atual (como funciona hoje)
Não existe nenhuma entidade, endpoint ou tela de "dose"/"registro de dose" no codebase. O que já existe e essa feature vai consumir:
- Medicamentos ativos por idoso: `GET /idosos/{idoso_id}/medicamentos` (`backend/app/routers/medicamentos.py:59-71`) lista só `ativo=True`.
- Cada `Medicamento` (`backend/app/models/medicamento.py`) já tem `horario` (time) e `frequencia_horas` (int) — dados necessários pra calcular o próximo horário previsto (RN18).
- Vínculo idoso-cuidador vive na tabela associativa `idoso_cuidador` (`backend/app/models/cuidador.py:8-15`), populada via `POST /idosos/{idoso_id}/cuidadores/{cuidador_id}` (`backend/app/routers/cuidadores.py:40-57` → `cuidador_service.vincular_cuidador`).
- Cuidador atual da sessão: `get_cuidador_atual_id` (`backend/app/routers/sessao.py:19-20`), injetado via `Depends`, retorna `int | None` — hoje **nenhum** endpoint exige que seja não-nulo (ex: `criado_por_cuidador_id` é sempre opcional).
- Tela `frontend/src/pages/IdosoDetalhe.tsx` já lista os medicamentos ativos do idoso numa `Table`, com botão de remover por linha — é onde a UI de confirmação de dose mais naturalmente se encaixa (uma ação por linha de medicamento, ou uma seção nova abaixo).

## 4) Fluxo desejado (comportamento esperado)
- Na tela do idoso, cada medicamento ativo mostra o próximo horário previsto (RN18, calculado a partir de `horario` + `frequencia_horas`, sem persistir esse cálculo) e um indicador visual de atraso quando o horário atual passa do previsto além de uma tolerância (RN19).
- O cuidador confirma a dose (ação de poucos cliques, RNF01) informando opcionalmente uma observação (RF13). O backend grava `medicamento_id`, `cuidador_id`, `confirmado_em`, `observacao?`.
- Se a dose daquele medicamento naquele horário previsto já foi confirmada por outro cuidador, a tentativa é bloqueada e a UI mostra quem confirmou e quando (RN15) — mesmo padrão de resposta estruturada (409 com objeto, não string) já usado no 409 de interação de alto risco em `medicamentos.py`.
- Não é possível confirmar dose com horário futuro (RN16) nem por cuidador não vinculado ao idoso (RN13).
- Existe uma visão de histórico de doses do idoso, visível a todos os cuidadores vinculados (RF11), somente leitura (RN20) — provavelmente uma nova seção/tabela na mesma `IdosoDetalhe.tsx`.

## 5) Mapa do Codebase (onde isso vive)

### 5.1 Entradas (rotas/telas/handlers)
- `backend/app/routers/medicamentos.py` — router de medicamentos existente; um novo router de doses (`registros_dose.py` ou similar) provavelmente segue o mesmo padrão de prefixo aninhado (`/medicamentos/{medicamento_id}/doses` ou `/idosos/{idoso_id}/doses` para o histórico agregado).
- `frontend/src/pages/IdosoDetalhe.tsx` — tela única de detalhe do idoso; hoje só tem cadastro/lista de medicamentos, vai ganhar ação de confirmar dose + histórico.

### 5.2 Domínio / Regras / Serviços
- `backend/app/services/medicamento_service.py` — padrão de service com `_verificar_duplicado` privado + funções públicas por operação; um `registro_dose_service.py` novo seguiria o mesmo formato (função de validação privada para RN15/RN16/RN13 + `confirmar_dose`/`listar_doses`).
- `backend/app/services/interacao_service.py` — exemplo de service que retorna um dataclass (`InteracaoEncontrada`) em vez de model, útil como referência para expor "quem confirmou e quando" no bloqueio RN15 sem vazar o objeto ORM inteiro.
- Cálculo de "próximo horário previsto" / "atrasado": não existe hoje nenhum campo computado do tipo, mas `Idoso.idade` (`backend/app/models/idoso.py:29-38`) é um `@property` Python simples (não `hybrid_property` do SQLAlchemy) exposto via `IdosoRead.idade` com `from_attributes=True` — é o padrão já validado no projeto para valores derivados, não persistidos.

### 5.3 Persistência / Modelos / Migrações
- Nova tabela provável: `registros_dose` (nome sugerido) — colunas mínimas pra cobrir RN14/RN17: `id`, `medicamento_id` (FK `medicamentos.id`), `cuidador_id` (FK `cuidadores.id`), `horario_previsto` (datetime — calculado pelo backend, não enviado pelo cliente; identifica "a mesma dose" pra RN15), `confirmado_em` (timestamp, `server_default=func.now()`), `observacao` (`str | None`), `UniqueConstraint(medicamento_id, horario_previsto)`.
- Sem soft delete aqui: RN20 diz que histórico é só leitura, não editável/removível — não precisa de coluna `ativo`.
- **Migrations**: projeto usa Alembic puro (não Flask-Migrate, apesar do `SDD/implementar.md` mencionar Flask-Migrate — ver Nota de conflito no `CLAUDE.md`). Histórico em `backend/migrations/versions/`: `57c204bc42db` (idosos/cuidadores), `3350335ecce2` (idade→data_nascimento), `e09521b3d190` (medicamentos + interacoes_medicamentosas). Fluxo: editar model → `alembic revision --autogenerate -m "..."` → revisar → `alembic upgrade head`. `backend/migrations/env.py:10` precisa importar o novo model pra autogenerate enxergá-lo (mesmo passo que faltou lembrar automaticamente na feature anterior).
- RN15 (não duplicar confirmação da mesma dose): reforçada em duas camadas — checagem em serviço (pré-`INSERT`, pra devolver 409 com "quem confirmou e quando" antes de tentar gravar) **e** `UniqueConstraint(medicamento_id, horario_previsto)` no banco (garante a regra sob concorrência real, quando dois cuidadores confirmam ao mesmo tempo). Decisão registrada na seção 10.

### 5.4 Integrações externas (clients/adapters/providers)
- Nenhuma. Cálculo de horário/atraso é local (sem dependência de serviço externo), mesma decisão de "base curada interna" já usada pra interação medicamentosa.

### 5.5 UI / Componentes (se aplicável)
- `frontend/src/components/ui/table.tsx`, `card.tsx`, `button.tsx`, `alert.tsx`, `dialog.tsx` — já instalados e usados em `IdosoDetalhe.tsx`; suficientes pra listar doses/histórico e mostrar bloqueio de duplicata (RN15) num `Alert`/`Dialog`, mesmo padrão do `ConfirmarInteracaoDialog.tsx`.
- `frontend/src/lib/api.ts` — client axios `withCredentials: true`, já carrega cookie de sessão do cuidador atual.
- Paleta/estilo visual já definida em `frontend/src/index.css` (tokens `--primary`, `--secondary`, `--accent`, etc.) — reusar, não redefinir.

### 5.6 Testes / Fixtures (se existirem)
- `backend/tests/conftest.py` — fixtures `db` (savepoint por teste) e `client` (TestClient com `get_db` sobrescrito); qualquer novo model precisa estar importado em algum ponto da cadeia de import de `app.main` antes do `Base.metadata.create_all(engine)` rodar no conftest (hoje isso acontece via `routers → services → models`).
- `backend/tests/test_medicamentos.py`, `test_interacoes.py` — padrão de teste: helper `_criar_idoso(client)`, POST direto via `TestClient`, inserção direta no banco via fixture `db` quando o teste precisa de estado que a API não expõe (ex: interações).

## 6) Padrões existentes para reuso (evitar duplicação)
- `backend/app/routers/medicamentos.py` — padrão de router: `try/except HTTPException: raise` + `except Exception: raise HTTPException(500, ...)` em toda rota (RNF03/RNF11).
- `backend/app/services/medicamento_service.py` — padrão de service: validação de regra de negócio levanta `HTTPException` direto do service (não só no router).
- `backend/app/routers/sessao.py:19-20` (`get_cuidador_atual_id`) — já pronto pra identificar o cuidador atual (RF14) em qualquer novo endpoint.
- `frontend/src/pages/Idosos.tsx` / `Cuidadores.tsx` / `IdosoDetalhe.tsx` — padrão de página: `useState` + `useEffect` pra carregar dados, função `extrairMensagemErro` pra tratar erro de API (a versão em `IdosoDetalhe.tsx` já trata `detail` como objeto, necessário se o 409 de dose duplicada seguir o mesmo formato do 409 de interação).
- `frontend/src/components/ConfirmarInteracaoDialog.tsx` — padrão de modal de bloqueio/confirmação via `Dialog` do shadcn; RN15 (bloqueio de dose duplicada) pode reusar a mesma estrutura de componente (props `open`/dados do bloqueio/`onConfirmar`/`onCancelar`), embora aqui não haja "confirmar mesmo assim" — é bloqueio informativo, não contornável.

## 7) Documentação externa (via Context7)

### Consultas realizadas
| Library ID | Query | Resumo do resultado |
|------------|-------|---------------------|
| `/websites/sqlalchemy_en_20_orm` | "hybrid_property for computed values derived from other columns" | Confirma que `hybrid_property` existe pra valores computados com suporte a expressão SQL (útil se precisar filtrar/ordenar por "atrasado" no banco). Como o projeto já usa `@property` Python simples pra `Idoso.idade` (sem necessidade de query por esse campo), o padrão mais consistente com o codebase é manter `@property` simples também pra "próximo horário previsto"/"atrasado" em vez de introduzir `hybrid_property` — ver Open Questions se for necessário filtrar/ordenar por atraso no backend. |

### Trechos relevantes
Nenhum trecho de biblioteca externa é necessário pra implementação — a feature usa só SQLAlchemy/Pydantic/FastAPI/React já em uso no projeto, sem API nova.

## 8) Impactos prováveis (áreas afetadas)
- Backend: novo model (`registro_dose.py`), nova migration, novo schema, novo service, novo router, `include_router` em `main.py`, `migrations/env.py` (import do model), testes novos.
- Frontend: `IdosoDetalhe.tsx` ganha ação de confirmar dose por medicamento + seção de histórico; possível novo componente de bloqueio de duplicata (ou reuso adaptado de `ConfirmarInteracaoDialog.tsx`).
- Nenhum model existente muda de schema (medicamentos/idosos/cuidadores ficam como estão).

## 9) Critérios de aceitação
- [x] Cuidador consegue confirmar uma dose de um medicamento ativo, opcionalmente com observação
- [x] Confirmar a mesma dose (mesmo medicamento, mesmo horário previsto) uma segunda vez é bloqueado, mostrando quem confirmou e quando
- [x] Não é possível confirmar dose com horário futuro
- [x] Histórico de doses do idoso é visível a qualquer cuidador, sem opção de editar/apagar
- [x] Medicamento com horário previsto vencido além da tolerância aparece marcado visualmente como atrasado
- [x] Erros (validação, conexão, duplicata) aparecem como mensagem legível, nunca stack trace ou tela em branco

## 10) Decisões (antes Open Questions)
Resolvidas nesta sessão, com base na prioridade declarada em `base.md` ("Núcleo inegociável = RN07 a RN15") e nos padrões já estabelecidos no código.

- **RN13 (dose só por cuidador vinculado) → obrigatório, não simplificável.** Diferente de RN02 (que `base.md` já autoriza simplificar), RN13 está dentro do núcleo inegociável (RN07-RN15). Decisão: o endpoint de confirmação de dose exige `cuidador_atual_id` não-nulo (401/403 se a sessão não tiver cuidador selecionado) e valida que esse cuidador está vinculado ao idoso dono do medicamento via `idoso_cuidador` (403 se não vinculado). É a primeira rota do projeto a exigir cuidador logado — as demais continuam permissivas.
- **Definição de "mesma dose" (RN15) → `horario_previsto` calculado pelo backend, nunca enviado pelo cliente.** Fórmula: a partir de `Medicamento.horario` (hora-do-dia âncora) e `Medicamento.frequencia_horas`, os horários programados do dia são `horario, horario + frequencia_horas, horario + 2×frequencia_horas, ...` (mod 24h). O "horário previsto" da dose pendente no momento da confirmação é o maior desses horários que seja `<= agora` (a última dose que já deveria ter sido tomada). O cliente não informa horário — só clica "confirmar dose"; o backend calcula e persiste `horario_previsto` (data+hora) junto do registro. Chave de deduplicação (RN15) = `medicamento_id + horario_previsto`.
- **Tolerância de atraso (RN19) → 30 minutos, fixo.** Escolhido o menor valor da faixa sugerida em `base.md` ("30-60 min"): mais conservador, relevante em contexto de segurança (idosos/polifarmácia). Não configurável nesta rodada.
- **RN15 — constraint de banco, não só serviço.** Diferente da decisão já tomada pra RN05 (duplicata de medicamento, só checagem em serviço): aqui é o caso central do produto (dois cuidadores confirmando a mesma dose ao mesmo tempo é exatamente o cenário que a feature existe pra evitar), então a checagem em serviço (pré-`INSERT`) é reforçada por `UniqueConstraint(medicamento_id, horario_previsto)` no banco, capturando o erro de integridade e traduzindo pra um 409 com "quem confirmou e quando" (nova consulta ao registro existente após o conflito).
- **Cálculo de doses futuras → só a dose pendente atual, sem fila.** RF10-13 falam de "uma dose" no singular; RF12 pede indicação de atraso, não uma agenda completa. Decisão: nada de tabela de "doses futuras/pendentes" — cada medicamento ativo expõe (calculado em runtime, não persistido) o próximo `horario_previsto` e uma flag `atrasado` (mesmo padrão de `@property` Python já usado em `Idoso.idade`, sem `hybrid_property`). O histórico (RF11) lista só doses já confirmadas (`registros_dose`), somente leitura (RN20).
