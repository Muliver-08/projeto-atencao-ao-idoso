# Briefing para Lovable — App de Atenção ao Idoso (Diário de Medicação)

## 1. O que é o produto

Diário de medicação compartilhado entre múltiplos cuidadores da mesma pessoa idosa. Resolve 4 problemas: dose duplicada/esquecida, horário incorreto, interação medicamentosa perigosa e falta de histórico confiável para consulta médica.

**Diferencial central (núcleo do produto, não pode ser simplificado):**
- Verificação automática de interação medicamentosa ao cadastrar remédio novo, contra uma base curada interna (sem API externa).
- Bloqueio de dose duplicada: se um cuidador já confirmou a dose, os demais são impedidos e veem quem confirmou e quando.

**Público-alvo da interface:** cuidadores familiares, majoritariamente entre 30 e 50 anos, usando principalmente celular. Não são profissionais de saúde. A interface precisa ser óbvia sem explicação, rápida de usar sob estresse (medicação de idoso é assunto sensível) e legível também por usuários mais velhos (parte dos cuidadores pode ser idosa).

---

## 2. Diretrizes de interface (fechadas com o time)

- **Estilo visual:** clínico/saúde sério — tons de azul/verde, visual de app de saúde profissional, sóbrio e confiável. Evitar tom infantilizado ou "fofo"; o assunto (medicação, risco) pede seriedade.
- **Navegação mobile:** bottom navigation bar fixa (ex: Idosos, Cuidadores, Histórico), ícones + labels, alcançável com o polegar. É o padrão mobile-first, não menu hambúrguer.
- **Tema:** suportar claro e escuro com toggle, ambos com bom contraste (ver RNF02 abaixo).
- **Confirmação de dose:** toque no medicamento abre um modal de confirmação com campo de observação opcional; confirmar grava a dose. Fluxo tem que caber em no máximo 2-3 toques (RNF01).
- **Alertas de risco alto (interação medicamentosa):** modal bloqueante que exige ação explícita do cuidador ("Entendo o risco e quero prosseguir") antes de salvar — nunca silencioso, nunca só um toast.
- **Bloqueio de dose duplicada:** modal ou alerta informativo (não contornável) mostrando quem já confirmou aquela dose e quando.
- **Erros:** sempre mensagem em linguagem simples, nunca "Error 500" ou tela em branco. Falha de conexão com o backend deve mostrar aviso, nunca travar a tela.
- **Acessibilidade:** contraste e tamanho de fonte generosos — parte do público-alvo é mais velha.
- **Histórico de doses:** sempre somente leitura — nenhuma ação de editar/apagar deve existir na UI para registros já confirmados.
- **Indicador de atraso:** medicamento com dose vencida (além da tolerância) precisa de sinalização visual clara e reconhecível à distância (cor/ícone), não só texto pequeno.
- **Identificação do cuidador:** não há login/senha. Um seletor simples ("Quem está usando o app agora?") define o cuidador atual da sessão; deve estar sempre visível/acessível, já que toda ação de escrita é atribuída a esse cuidador.

---

## 3. Stack técnica

### Frontend (o que o Lovable vai gerar/substituir)
- React 19 + Vite + TypeScript
- Roteamento: `react-router` v8 (`createBrowserRouter`)
- Estilo: Tailwind CSS v4
- Componentes: shadcn/ui sobre `@base-ui/react` (não Radix) — componentes já em uso: `button`, `input`, `select`, `card`, `table`, `alert`, `dialog`
- HTTP: axios, instância única com `withCredentials: true` (cookie de sessão do cuidador atual)
- Sem gerenciador de estado global (Redux/Zustand) — `useState`/`useEffect` por página
- Sem `react-hook-form`/`zod` — formulários controlados manualmente
- Fonte: Geist Variable

### Backend (consumido via HTTP, não gerado pelo Lovable)
- Python + FastAPI + SQLAlchemy 2.0 (estilo declarativo `Mapped`/`mapped_column`)
- PostgreSQL 17, migrações via Alembic
- Autenticação: nenhuma — sessão simples por cookie assinado (`SessionMiddleware`), guardando `cuidador_id` escolhido
- Comunicação: HTTP puro via `VITE_API_URL`, CORS explícito liberando só a origem do frontend
- Deploy: backend no Render (Web Service contínuo, não serverless), frontend na Vercel

---

## 4. Requisitos Funcionais (RF)

**Idoso e cuidadores**
- RF01 — Cadastrar idoso (nome, data de nascimento, observações de saúde)
- RF02 — Cadastrar cuidador (nome, telefone)
- RF03 — Vincular múltiplos cuidadores a um mesmo idoso
- RF04 — Qualquer cuidador vinculado pode visualizar dados do idoso e seu histórico
- RF14 — Identificar qual cuidador está agindo, via seletor simples ("quem está usando o app agora"), sem senha/login

**Medicamentos**
- RF05 — Cadastrar medicamento para um idoso (nome, princípio ativo, dosagem, horário, frequência)
- RF06 — Registro MS (ANVISA) é opcional
- RF07 — Editar ou remover (inativar) um medicamento cadastrado
- RF08 — Verificar automaticamente interação de risco ao cadastrar medicamento novo
- RF09 — Exibir alerta visual claro quando houver interação de risco

**Doses**
- RF10 — Confirmar administração de uma dose (medicamento, horário, quem confirmou)
- RF11 — Exibir histórico de doses, visível a todos os cuidadores vinculados
- RF12 — Indicar visualmente quando uma dose está atrasada
- RF13 — Observação opcional ao confirmar uma dose

---

## 5. Regras de Negócio (RN) — o que a interface precisa respeitar

**Idoso e cuidadores**
- RN01 — Um idoso pode ter vários cuidadores; um cuidador pode estar vinculado a mais de um idoso
- RN03 — Toda ação de cadastro/edição/confirmação registra qual cuidador a realizou

**Medicamentos**
- RN04 — Medicamento pertence a exatamente um idoso
- RN05 — Bloqueado cadastrar dois medicamentos ativos idênticos (mesmo princípio ativo + dosagem) para o mesmo idoso — mensagem legível, não erro cru
- RN06 — Remover medicamento é soft delete (inativação lógica); a lista de "ativos" some, mas o histórico de doses permanece íntegro

**Interação medicamentosa (núcleo)**
- RN07 — Ao cadastrar medicamento novo, compara princípio ativo com os medicamentos ativos do mesmo idoso
- RN08 — Cada par de princípios ativos tem risco fixo na base curada: baixo, moderado ou alto
- RN09 — Risco alto exige confirmação explícita do cuidador ("Entendo o risco e quero prosseguir") antes de salvar — é um fluxo em 2 passos: primeira tentativa retorna a interação; segunda chamada, já confirmada, salva
- RN10 — Risco moderado é só informativo, não bloqueia o cadastro
- RN11 — Se houver múltiplas interações, mostrar a de maior risco
- RN12 — Base de interações é fixa/curada pela equipe; não há tela de edição dessa base no app

**Registro de doses (núcleo)**
- RN13 — Dose só pode ser confirmada por cuidador vinculado àquele idoso (única regra do sistema que exige cuidador logado — as demais ações são mais permissivas)
- RN14 — Todo registro de dose contém: medicamento, cuidador responsável, data/hora da confirmação
- RN15 — Regra central: não permitir confirmar a mesma dose (mesmo medicamento, mesmo horário previsto) duas vezes — se já confirmada, bloqueia e mostra quem confirmou e quando
- RN16 — Não é possível confirmar dose com horário futuro
- RN17 — Observação opcional pode ser anexada à confirmação

**Horários e atrasos**
- RN18 — Próximo horário previsto de cada medicamento é calculado a partir do horário-âncora + frequência em horas (não é digitado pelo usuário na hora de confirmar)
- RN19 — Dose é considerada atrasada quando passa do horário previsto em mais de 30 minutos (tolerância fixa)

**Histórico**
- RN20 — Histórico de doses é imutável — só visualização, nunca edição ou exclusão pela interface

---

## 6. Requisitos Não Funcionais (RNF) relevantes para a UI

- RNF01 — Confirmar uma dose deve levar no máximo 2-3 toques
- RNF02 — Contraste e tamanho de fonte adequados (público pode incluir pessoas mais velhas)
- RNF03 — Mensagens de erro sem jargão técnico, nunca "Error 500" cru
- RNF04 — Validar dados de entrada no formulário (horário inválido, dosagem vazia, telefone fora do formato) antes/além da validação do backend
- RNF05 — Falha de conexão com o backend mostra mensagem amigável, nunca tela em branco
- RNF06 — Impedir visualmente o envio de cadastros duplicados críticos quando detectável no client
- RNF07 — Interface deve tolerar respostas lentas da API (cold start do plano free do backend) sem parecer travada — usar estados de loading
- RNF08/RNF09 — Acessível via navegador, sem instalação, uso 100% web

---

## 7. Rotas do backend (contrato de API para o frontend consumir)

Base: sessão via cookie (`withCredentials: true`), sem token/header de auth.

### Sessão do cuidador atual
| Método | Rota | Descrição |
|---|---|---|
| POST | `/sessao` | Define o cuidador atual (`{ cuidador_id }`), grava na sessão. 404 se não existir. |
| GET | `/sessao` | Retorna `{ cuidador_id }` do cuidador atual (ou `null`) |

### Idosos
| Método | Rota | Descrição |
|---|---|---|
| POST | `/idosos` | Cria idoso (`nome`, `data_nascimento`, `observacoes?`). Retorna idoso com `idade` calculada e lista de `cuidadores`. |
| GET | `/idosos` | Lista todos os idosos |
| GET | `/idosos/{idoso_id}` | Detalhe de um idoso |

### Cuidadores
| Método | Rota | Descrição |
|---|---|---|
| POST | `/cuidadores` | Cria cuidador (`nome`, `telefone` no formato `(xx) xxxxx-xxxx`) |
| GET | `/cuidadores` | Lista todos os cuidadores |
| POST | `/idosos/{idoso_id}/cuidadores/{cuidador_id}` | Vincula um cuidador existente a um idoso (204, sem corpo) |

### Medicamentos
| Método | Rota | Descrição |
|---|---|---|
| POST | `/idosos/{idoso_id}/medicamentos` | Cria medicamento. Corpo: `nome`, `principio_ativo`, `dosagem`, `horario` (HH:MM), `frequencia_horas` (1-24), `registro_ms?`, `confirmar_risco_alto` (bool, default `false`). **Fluxo de risco alto:** 1ª chamada sem `confirmar_risco_alto=true` retorna **409** com `{ mensagem, interacao: { principio_ativo_a, principio_ativo_b, nivel_risco } }` — a UI deve reenviar a mesma chamada com `confirmar_risco_alto: true` para salvar. Sucesso (201) retorna `{ medicamento, interacao }`, onde `interacao` vem preenchida (não bloqueante) se o risco for moderado. |
| GET | `/idosos/{idoso_id}/medicamentos` | Lista só medicamentos **ativos** do idoso. Cada item já traz `proximo_horario_previsto` e `atrasado` calculados pelo backend. |
| PATCH | `/medicamentos/{medicamento_id}` | Atualiza campos parciais do medicamento |
| DELETE | `/medicamentos/{medicamento_id}` | Soft delete (inativa), 204 |

### Registro de doses
| Método | Rota | Descrição |
|---|---|---|
| POST | `/medicamentos/{medicamento_id}/doses` | Confirma a dose pendente atual. Corpo: `{ observacao? }` — horário não é enviado, o backend calcula. **Se a dose já foi confirmada por outro cuidador, retorna 409** com o registro existente (`cuidador`, `confirmado_em`) para a UI mostrar quem/quando. |
| GET | `/idosos/{idoso_id}/doses` | Histórico completo de doses confirmadas do idoso (somente leitura), com `medicamento_id`, `horario_previsto`, `confirmado_em`, `observacao`, `cuidador`. |

### Padrão de erro
Todo endpoint retorna erros de negócio como `HTTPException` com `detail` em texto legível (exceto os dois casos de 409 documentados acima, que retornam `detail` como objeto estruturado). Falhas inesperadas retornam 500 com mensagem genérica, nunca stack trace.

---

## 8. Telas hoje existentes (ponto de partida, não o alvo final)

- `Home` — landing simples
- `Idosos` — lista + cadastro de idosos
- `IdosoDetalhe` (`/idosos/:id`) — tela central: lista de medicamentos ativos do idoso, cadastro de medicamento, confirmação de dose, histórico de doses
- `Cuidadores` — lista + cadastro de cuidadores, vínculo com idoso

O objetivo do redesign no Lovable é reconstruir essas telas (e o fluxo de navegação) sob as diretrizes de interface da seção 2, mantendo o contrato de API da seção 7.
