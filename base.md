Contexto do Projeto — Hackathon IFRS Campus Feliz
Este documento reúne todo o contexto do projeto para orientar o desenvolvimento. Leia tudo antes de começar a gerar código.


1. Sobre o evento
Evento: Hackathon IFRS Campus Feliz, 14 e 15/08/2026
Tempo de desenvolvimento: ~16h (20h do dia 14 até 12h do dia 15)
Tema (revelado na abertura): ATENÇÃO AO IDOSO
Equipe: 5 pessoas
Uso de IA generativa é permitido, mas deve ser declarado explicitamente aos avaliadores (verbalmente na triagem, e na apresentação oral da 2ª etapa)
Critérios de avaliação — 1ª etapa (triagem técnica, eliminatória)
A. Uso de recursos (IA, IDEs, frameworks) para prototipação rápida
B. Complexidade técnica (mesmo que parcialmente implementada)
C. Qualidade de software — tratamento de exceções e erros
D. Boas práticas de usabilidade e ergonomia (UX)
E. Boas práticas de desenvolvimento, clareza e organização do código
Critérios de avaliação — 2ª etapa (apresentação, só para os 4 finalistas)
Reavalia os critérios técnicos acima + critérios temáticos:

Criatividade e inovação
Aderência ao tema do evento
Viabilidade de execução real
Potencial de replicação e escalabilidade
Qualidade da apresentação

Implicação prática: o código precisa ter tratamento de erros visível, boas práticas claras (separação em camadas), e a solução deve funcionar de ponta a ponta mesmo que pequena — é melhor um MVP pequeno e sólido do que algo grande e quebrado.


2. Problema definido
Uso incorreto de medicamentos em idosos, sob a ótica de cuidadores/família (não do próprio idoso nem de profissionais de saúde).

Decomposição do problema:

Dose duplicada ou esquecida — vários cuidadores, ninguém sabe com certeza o que já foi dado
Horário de medicação incorreto
Interação medicamentosa perigosa (comum em idosos com polifarmácia)
Falta de histórico confiável para mostrar em consulta médica/emergência
Diferencial da solução
Um diário de medicação compartilhado entre múltiplos cuidadores da mesma pessoa idosa, com:

Histórico único e em tempo real, visível a todos os cuidadores vinculados
Registro de quem confirmou cada dose e quando
Verificação automática de interação medicamentosa ao cadastrar um novo remédio, usando uma base de dados própria e curada (sem depender de APIs externas de bulário, que são instáveis/não têm API oficial aberta — ver seção 6)
Bloqueio de dose duplicada: se um cuidador já confirmou, o sistema informa aos demais e impede confirmação repetida


3. Stack técnica definida
Frontend: React (via Vite) + Bootstrap ou Tailwind (estilização)
Backend: Python + FastAPI + SQLAlchemy 2.0 (ORM)
Banco de dados: PostgreSQL 17
Deploy do frontend: Vercel
Deploy do backend: Render (Web Service)
Banco de dados em produção: PostgreSQL gerenciado pelo próprio Render (evita conta extra em Neon/Supabase)
Decisões técnicas importantes (não mudar sem motivo forte)
NÃO hospedar o backend FastAPI na Vercel — Vercel é otimizada para serverless e causa problemas de cold start, timeout e esgotamento de conexões com Postgres. O backend vai no Render, que roda como processo contínuo.
Frontend e backend são deployados separadamente, cada um com sua própria URL pública, e se comunicam via HTTP usando a variável de ambiente VITE_API_URL no frontend.
CORS deve ser configurado explicitamente no FastAPI (CORSMiddleware) liberando a origem real da Vercel após o deploy.
Já existe um boilerplate validado localmente (FastAPI com CORS + endpoint de teste, e React consumindo a API) — usar como ponto de partida da estrutura de pastas e configuração, não recriar do zero.


4. Requisitos Funcionais (RF)
Gestão de idoso e cuidadores

RF01 — Cadastrar um idoso (nome, idade, observações de saúde relevantes)
RF02 — Cadastrar cuidadores (nome, telefone/contato)
RF03 — Vincular múltiplos cuidadores a um mesmo idoso
RF04 — Qualquer cuidador vinculado pode visualizar os dados do idoso e seu histórico

Gestão de medicamentosa

RF05 — Cadastrar medicamento para um idoso (nome, princípio ativo, dosagem, horário, frequência)
RF06 — Informar opcionalmente o número de Registro MS (ANVISA) do medicamento
RF07 — Editar ou remover (inativar) um medicamento cadastrado
RF08 — Ao cadastrar um novo medicamento, verificar automaticamente interação de risco com os medicamentos já cadastrados para aquele idoso
RF09 — Exibir alerta visual claro quando uma interação de risco for identificada

Registro de doses

RF10 — Permitir que um cuidador registre a confirmação de uma dose administrada (medicamento, horário, quem confirmou)
RF11 — Exibir histórico de doses administradas, visível a todos os cuidadores vinculados
RF12 — Indicar visualmente quando uma dose está atrasada
RF13 — Permitir observação opcional ao confirmar uma dose (ex: "idoso relatou tontura")

Identificação do cuidador (autenticação simplificada)

RF14 — O sistema deve identificar qual cuidador está realizando cada ação. Sugestão de implementação rápida: seletor de cuidador (dropdown "quem está usando o app agora"), sem senha/login completo — suficiente para rastreabilidade dentro do prazo do hackathon.


5. Requisitos Não Funcionais (RNF)
Usabilidade (pesa no critério D)

RNF01 — Interface simples, no máximo 2-3 cliques para registrar uma dose
RNF02 — Contraste e tamanho de fonte adequados (parte dos cuidadores pode ser idosa também)
RNF03 — Mensagens de erro compreensíveis, sem jargão técnico (nunca expor "Error 500" cru)

Confiabilidade e tratamento de erros (critério C)

RNF04 — Validar dados de entrada (horário inválido, dosagem vazia, etc.)
RNF05 — Tratar falhas de conexão com o backend sem quebrar a interface (mostrar mensagem, nunca tela em branco)
RNF06 — Impedir cadastro de dados duplicados críticos (mesmo medicamento cadastrado duas vezes pro mesmo idoso)

Desempenho

RNF07 — Respostas da API em tempo aceitável (idealmente <1-2s, considerando cold start do plano free do Render)

Disponibilidade

RNF08 — Acessível via navegador, sem instalação
RNF09 — Publicamente acessível via deploy (Vercel + Render) durante a avaliação

Manutenibilidade e boas práticas (critério E)

RNF10 — Código organizado em camadas (rotas, modelos, lógica de negócio separados)
RNF11 — Tratamento explícito de exceções nos principais endpoints (try/except com respostas HTTP apropriadas, não deixar stack trace vazar)

Segurança básica

RNF12 — Dados sensíveis não expostos em logs ou na URL
RNF13 — CORS configurado para aceitar apenas a origem oficial do frontend


6. Regras de Negócio (RN)
Idoso e cuidadores

RN01 — Um idoso pode ter vários cuidadores; um cuidador pode estar vinculado a mais de um idoso
RN02 — Um idoso só pode ser visualizado por cuidadores explicitamente vinculados a ele
RN03 — Toda ação de cadastro, edição ou confirmação deve registrar qual cuidador a realizou

Medicamentos

RN04 — Um medicamento pertence a exatamente um idoso (não é compartilhado entre cadastros)
RN05 — Não permitir cadastrar dois medicamentos ativos idênticos (mesmo princípio ativo e dosagem) para o mesmo idoso
RN06 — Remover medicamento é inativação lógica (soft delete) — preserva histórico de doses já confirmadas

Verificação de interação medicamentosa (núcleo do diferencial)

RN07 — Ao cadastrar medicamento novo, comparar seu princípio ativo com os princípios ativos dos medicamentos ativos do mesmo idoso
RN08 — Cada combinação de princípios ativos tem nível de risco fixo na base curada: baixo, moderado ou alto
RN09 — Interação de risco alto exige confirmação explícita do cuidador antes de salvar ("Entendo o risco e quero prosseguir")
RN10 — Interação de risco moderado é apenas informativa, não bloqueia
RN11 — Se houver múltiplas interações simultâneas, priorizar exibição da de maior risco
RN12 — A base de interações conhecidas é fixa/curada pela equipe; cuidadores não podem editá-la pelo app

Registro de doses

RN13 — Dose só pode ser confirmada por cuidador vinculado àquele idoso
RN14 — Todo registro de dose deve conter: medicamento, cuidador responsável, data/hora da confirmação
RN15 — Regra central: não permitir confirmar a mesma dose (mesmo medicamento, mesmo horário previsto) duas vezes — se outro cuidador já confirmou, bloquear e informar quem já deu e quando
RN16 — Não permitir confirmar dose com horário futuro
RN17 — Observação opcional pode ser anexada à confirmação

Horários e atrasos

RN18 — Próximo horário previsto de cada medicamento é calculado com base na frequência cadastrada
RN19 — Dose é considerada atrasada quando o horário atual ultrapassa o previsto em uma tolerância definida (ex: 30-60 min) sem confirmação

Histórico

RN20 — Histórico de doses é imutável por qualquer cuidador — só pode ser visualizado, nunca apagado

Prioridade de implementação (se faltar tempo): Núcleo inegociável = RN07 a RN15 (verificação de interação + bloqueio de dose duplicada), pois é o que resolve o problema central. RN06 e RN20 (soft delete e imutabilidade) são simples e reforçam robustez. RN02/RF14 pode ser simplificado com seletor de cuidador sem senha.