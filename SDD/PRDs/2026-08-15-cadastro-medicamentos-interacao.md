# PRD — Cadastro de Medicamentos e Verificação de Interação Medicamentosa

## 1) Objetivo
- Permitir que um cuidador cadastre medicamentos para um idoso já existente, com verificação automática de interação de risco contra os medicamentos ativos do mesmo idoso, usando uma base de dados curada e interna (sem API externa).
- É o núcleo diferencial do produto (base.md, seção 2 e "Prioridade de implementação"): sem isso, o diário de medicação é só uma lista; com isso, previne o cenário de risco real (polifarmácia perigosa em idosos).
- Também é pré-requisito direto para a próxima feature do ciclo (registro de doses, RF10-13/RN13-20), que depende de medicamentos existentes.

## 2) Escopo
**Inclui**
- RF05 — Cadastrar medicamento para um idoso (nome, princípio ativo, dosagem, horário, frequência)
- RF06 — Registro MS (ANVISA) opcional
- RF07 — Editar ou remover (inativar) um medicamento cadastrado
- RF08 — Verificação automática de interação de risco ao cadastrar medicamento novo
- RF09 — Alerta visual claro quando houver interação de risco
- RN04 — Medicamento pertence a exatamente um idoso
- RN05 — Bloquear medicamento ativo duplicado (mesmo princípio ativo + dosagem) para o mesmo idoso
- RN06 — Remoção é soft delete (inativação lógica); histórico de doses futuras dependerá disso permanecer íntegro
- RN07 — Comparar princípio ativo do medicamento novo com os medicamentos ativos do idoso
- RN08 — Base curada de pares de princípios ativos com nível de risco fixo (baixo/moderado/alto)
- RN09 — Interação de risco alto exige confirmação explícita do cuidador antes de salvar
- RN10 — Interação moderada é só informativa, não bloqueia
- RN11 — Múltiplas interações simultâneas: exibir a de maior risco
- RN12 — Base de interações é fixa/curada pela equipe; cuidadores não editam via app

**Não inclui (fora de escopo)**
- RF10-13 / RN13-20 (registro de doses, bloqueio de dose duplicada, atraso) — próximo ciclo SDD
- RN02 (restringir visualização a cuidadores vinculados) — ainda não decidido, feature futura
- Edição da base de interações pela UI (RN12 explicitamente proíbe) — só seed/migration
- Fonte de dados de interação em tempo real/API externa — base.md seção 2 é explícito: "sem depender de APIs externas de bulário"

## 3) Fluxo atual (como funciona hoje)
Existe apenas a feature de idoso+cuidadores (`SDD/PLAN/2026-08-14-cadastro-idoso-cuidadores.md`, todas as 6 fases concluídas). Não há nada de medicamento no codebase ainda.

- `backend/app/models/idoso.py` — `Idoso` com `id`, `nome`, `data_nascimento`, `observacoes`, `criado_em`, `criado_por_cuidador_id`, relação N:N `cuidadores` via tabela `idoso_cuidador`
- `backend/app/models/cuidador.py` — `Cuidador` com `id`, `nome`, `telefone`, `criado_em`, `criado_por_cuidador_id`; e a `Table` de associação `idoso_cuidador` (com `vinculado_em`, `vinculado_por_cuidador_id`)
- Sessão do cuidador atual: `backend/app/routers/sessao.py`, `get_cuidador_atual_id(request: Request) -> int | None` lê `request.session["cuidador_id"]` (cookie assinado via `SessionMiddleware`). Esse helper é importado por `routers/idosos.py` e `routers/cuidadores.py` para popular `criado_por_cuidador_id` (RN03).
- Camadas: `routers/` (HTTP + try/except → `HTTPException`) → `services/` (regra de negócio, recebe `Session` e `criado_por_cuidador_id`) → `models/` (SQLAlchemy declarative).

## 4) Fluxo desejado (comportamento esperado)
1. Cuidador seleciona um idoso já cadastrado e abre a tela de medicamentos dele.
2. Cuidador preenche formulário de novo medicamento (nome, princípio ativo, dosagem, horário, frequência, Registro MS opcional).
3. Ao submeter, backend compara o princípio ativo contra os princípios ativos dos medicamentos **ativos** do mesmo idoso, usando a base curada de pares (RN07/RN08).
4. Se não houver interação: salva normalmente, registra `criado_por_cuidador_id` (RN03).
5. Se houver interação moderada: salva e retorna aviso informativo (RN10) — não bloqueia.
6. Se houver interação de risco alto: backend não salva de primeira — retorna a interação encontrada para a UI pedir confirmação explícita ("Entendo o risco e quero prosseguir"); só salva numa segunda chamada confirmada (RN09).
7. Se houver múltiplas interações, mostrar/retornar a de maior risco (RN11).
8. Medicamento duplicado (mesmo princípio ativo + dosagem, ativo) é rejeitado com mensagem legível (RN05/RNF06), nunca erro cru.
9. Editar/remover medicamento: remover é soft delete (marca inativo, não apaga linha) — RN06.
10. Lista de medicamentos do idoso mostra só os ativos por padrão (inativos preservados no banco, não exibidos como "atuais").

## 5) Mapa do Codebase (onde isso vive)

### 5.1 Entradas (rotas/telas/handlers) — planejado
- Novo `backend/app/routers/medicamentos.py`, seguindo o padrão de `backend/app/routers/idosos.py` (`APIRouter`, `Depends(get_db)`, `Depends(get_cuidador_atual_id)` de `app.routers.sessao`, try/except → `HTTPException` com mensagem legível)
- Novo `frontend/src/pages/Medicamentos.tsx` (ou rota aninhada `/idosos/:id/medicamentos`), seguindo o padrão de `frontend/src/pages/Idosos.tsx` e `Cuidadores.tsx` (form controlado com `useState`, sem `react-hook-form`/`zod` — ver Amendments do PLAN anterior)
- `frontend/src/main.tsx` precisará de rota nova (atualmente só tem `/`, `/idosos`, `/cuidadores` — ver `SDD/PLAN/2026-08-14-cadastro-idoso-cuidadores.md` Amendments para a versão real instalada de `react-router` v8, API `createBrowserRouter`/`RouterProvider` de `react-router/dom`)

### 5.2 Domínio / Regras / Serviços — planejado
- Novo `backend/app/services/medicamento_service.py`, seguindo padrão de `backend/app/services/idoso_service.py` / `cuidador_service.py`: funções puras que recebem `Session` + dados, levantam `HTTPException` para erros de negócio
- Nova lógica de verificação de interação (RN07-RN11) — pode viver no mesmo `medicamento_service.py` ou em `backend/app/services/interacao_service.py` separado, dado que é uma responsabilidade distinta (consulta à base curada, não CRUD)

### 5.3 Persistência / Modelos / Migrações — planejado
- Novo `backend/app/models/medicamento.py`: `Medicamento` (id, idoso_id FK, nome, principio_ativo, dosagem, horario, frequencia, registro_ms opcional, ativo: bool default True, criado_em, criado_por_cuidador_id) — segue o padrão de auditoria já usado em `Idoso`/`Cuidador`
- Novo `backend/app/models/interacao.py` (ou tabela dentro de `medicamento.py`): tabela curada de pares `principio_ativo_a`, `principio_ativo_b`, `nivel_risco` (enum baixo/moderado/alto) — populada via seed/migration de dados (RN12: não editável pelo app)
- **Migrations**: projeto usa **Alembic** (não Flask-Migrate — confirmado na feature anterior, `SDD/PLAN/2026-08-14-cadastro-idoso-cuidadores.md` "Migration Notes"). Histórico atual em `backend/migrations/versions/`:
  - `57c204bc42db_create_idosos_cuidadores_tables.py` — cria `idosos`, `cuidadores`, `idoso_cuidador`
  - `3350335ecce2_idoso_idade_para_data_nascimento_.py` — troca `idade` por `data_nascimento` em `Idoso`
  - Esta feature vai precisar de pelo menos 2 migrations novas: (1) criar `medicamentos` (DDL), (2) criar tabela de interações curadas + seed de dados iniciais (separar DDL de DML conforme `SDD/implementar.md` seção "Regras para Migrations")
- `UniqueConstraint` em `medicamentos` para RN05 precisa ser condicional a `ativo=True` (constraint parcial) — Postgres suporta via `Index` com `postgresql_where`, não `UniqueConstraint` puro; ou aplicar a checagem de duplicidade só na camada de serviço (mais simples, dado o prazo do hackathon) — ver Open Questions

### 5.4 Integrações externas (clients/adapters/providers)
- Nenhuma — RN12 e base.md seção 2 são explícitos: base de interação é interna/curada, sem API externa de bulário.

### 5.5 UI / Componentes (se aplicável) — planejado
- shadcn/ui já instalado neste projeto com estilo `base-nova` (base-ui, não Radix) — componentes disponíveis hoje: `button`, `input`, `select`, `card`, `table`, `alert` (`frontend/src/components/ui/`). O componente `form` **não existe** neste registry (confirmado na feature anterior) — formulários usam `useState` controlado.
- Para o alerta de interação de risco alto (RN09, "Entendo o risco e quero prosseguir"), reusar `Alert`/`AlertDescription` (`frontend/src/components/ui/alert.tsx`, variant `destructive` já существует) + um `Button` de confirmação — não há componente de modal/dialog instalado ainda (avaliar se precisa instalar `dialog` do shadcn ou se um `Alert` inline com botão de confirmação basta)
- Padrão de mensagens de erro já estabelecido em `Idosos.tsx`/`Cuidadores.tsx`: função `extrairMensagemErro(erro, padrao)` que lê `erro.response?.data?.detail` do axios — reusar o mesmo padrão

### 5.6 Testes / Fixtures (se existirem)
- `backend/tests/conftest.py` — fixtures `db` (Session isolada via savepoint + rollback) e `client` (`TestClient` com `get_db` override), banco de teste `atencao_idoso_test` auto-criado. Reusar diretamente para os novos testes de medicamento/interação.
- `backend/tests/test_idosos.py`, `test_cuidadores.py`, `test_sessao.py` — padrão de teste a seguir (funções `_criar_idoso`/`_criar_cuidador` como helpers locais)
- Sem testes de frontend em nenhuma feature até agora (decisão do ciclo anterior, não solicitado)

## 6) Padrões existentes para reuso (evitar duplicação)
- `app.database.get_db` (`backend/app/database.py`) — dependency de sessão síncrona, usar via `Depends(get_db)`
- `app.routers.sessao.get_cuidador_atual_id` (`backend/app/routers/sessao.py`) — dependency que lê o cuidador atual da sessão; usar em todo endpoint de escrita para popular `criado_por_cuidador_id` (RN03)
- Padrão de router: try/except genérico → `HTTPException(500, "mensagem legível")`, deixando `HTTPException` de negócio (404, 422) passar direto (`backend/app/routers/idosos.py` linhas 18-25 é o modelo exato)
- Padrão de schema Pydantic: `Create` (entrada, com `field_validator`/`Field(pattern=...)`) + `Read` (`ConfigDict(from_attributes=True)`) — ver `backend/app/schemas/idoso.py`, `cuidador.py`
- `frontend/src/lib/api.ts` — instância axios única (`withCredentials: true`), reusar para todas as chamadas novas
- `frontend/src/lib/utils.ts` (`cn`) e os componentes em `frontend/src/components/ui/` — reusar em vez de recriar
- Máscaras de input client-side (padrão `formatarTelefone`/`formatarData` em `frontend/src/pages/Cuidadores.tsx` e `Idosos.tsx`): função pura que só permite dígitos e insere separadores — mesmo padrão pode servir pra campo de horário, se decidido usar texto mascarado em vez de `<input type="time">`

## 7) Documentação externa (via Context7)

### Consultas realizadas
| Library ID | Query | Resumo do resultado |
|------------|-------|---------------------|
| `/websites/sqlalchemy_en_20_orm` | "unique constraint across multiple columns and CheckConstraint on a table, UniqueConstraint declarative style" | `UniqueConstraint` via `__table_args__`; para constraint condicional (só quando `ativo=True`) SQLAlchemy não tem um atalho declarativo — precisa de `Index(..., postgresql_where=...)`, específico do dialect Postgres |

### Trechos relevantes
- **SQLAlchemy — UniqueConstraint declarativo** (`__table_args__`):
  ```python
  class Medicamento(Base):
      __tablename__ = "medicamentos"
      __table_args__ = (UniqueConstraint("idoso_id", "principio_ativo", "dosagem"),)
  ```
  Nota: isso bloquearia duplicata mesmo entre um medicamento ativo e um inativo (histórico). RN05 fala em "medicamentos **ativos** idênticos" — se for pra permitir recadastro após inativação, a constraint incondicional do banco não serve sozinha; precisa decisão (ver Open Questions).

## 8) Impactos prováveis (áreas afetadas)
- Backend: 1 model novo (`Medicamento`) + 1-2 models/tabelas novas (interação curada), 2 migrations, 1 schema novo, 1-2 services novos, 1 router novo, `main.py` (`include_router`), testes novos
- Frontend: 1 página nova (lista + form de medicamento), possível componente de alerta de confirmação de risco alto, rota nova em `main.tsx`, possível novo componente shadcn (`dialog`, se optar por modal em vez de alert inline)
- Dado inicial: seed da base curada de interações (RN12) — precisa de dados reais de pares princípio-ativo × risco definidos pela equipe antes da implementação (não é código, é conteúdo)
- Nenhum impacto na feature anterior (idoso/cuidador) além de `Medicamento` referenciar `Idoso` e `Cuidador` via FK

## 9) Critérios de aceitação
- [ ] É possível cadastrar um medicamento para um idoso com nome, princípio ativo, dosagem, horário e frequência
- [ ] Registro MS é opcional no cadastro
- [ ] É possível editar um medicamento cadastrado
- [ ] Remover um medicamento não apaga a linha do banco (soft delete) — permanece consultável no histórico
- [ ] Cadastrar medicamento com princípio ativo que interage (risco alto) com um já ativo do idoso exige confirmação explícita antes de salvar
- [ ] Interação de risco moderado aparece como aviso mas não impede salvar
- [ ] Quando há mais de uma interação, a de maior risco é a exibida
- [ ] Tentar cadastrar dois medicamentos ativos idênticos (mesmo princípio ativo + dosagem) pro mesmo idoso é bloqueado com mensagem legível
- [ ] Erros de validação aparecem como mensagem legível, nunca stack trace ou tela branca

## 10) Decisões (resolvidas com o usuário em 2026-08-15)
- **Conteúdo da base curada de interações**: placeholder fictício por agora — seed com 2-3 pares inventados só pra validar o mecanismo tecnicamente (RN07-RN11). Conteúdo real de domínio (pares/riscos reais) fica pendente, a ser substituído pela equipe depois.
- **RN05 (duplicata só entre ativos)**: checagem só na camada de serviço (query antes de inserir, dentro da mesma transação). Sem índice único parcial no Postgres — mais simples, suficiente pro volume/uso do hackathon.
- **Formato de horário/frequência**: `horario` (time do primeiro horário do dia) + `frequencia_horas` (int, ex: a cada 8h). Estruturado o suficiente pra suportar cálculo de próxima dose/atraso (RN18/RN19) na feature seguinte, sem parsing de texto livre.
- **UI de confirmação de risco alto (RN09)**: modal/Dialog — precisa instalar o componente `dialog` do shadcn (`pnpm dlx shadcn@latest add dialog`, mesmo registry `base-nova`/base-ui já em uso; confirmar disponibilidade do componente nesse registry na Spec/implementação, já que `form` não estava disponível).
- **Onde a tela de medicamentos vive**: nova rota de detalhe `/idosos/:id`, introduzindo página de detalhe do idoso (hoje só existe lista+form em `/idosos`). A lista de medicamentos do idoso mora dentro dessa página. Abre caminho natural pra próxima feature (doses) também morar ali.
