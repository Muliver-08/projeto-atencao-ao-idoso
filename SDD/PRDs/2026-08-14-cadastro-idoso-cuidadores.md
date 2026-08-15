# PRD — Cadastro de Idoso e Cuidadores

## 1) Objetivo
- Entregar o alicerce de dados do sistema: cadastro de idoso, cadastro de cuidadores, vínculo N:N entre eles, e um seletor de "cuidador atual" no frontend (RF14) para rastreabilidade de ações.
- Sem isso, nenhuma outra feature (medicamentos, interação, doses) tem onde se apoiar — todo RF05+ depende de um idoso existir e de saber "quem" está agindo.

## 2) Escopo
**Inclui**
- RF01 — Cadastrar idoso (nome, idade, observações de saúde)
- RF02 — Cadastrar cuidador (nome, telefone/contato)
- RF03 — Vincular múltiplos cuidadores a um mesmo idoso (N:N)
- RF04 — Qualquer cuidador vinculado pode visualizar dados do idoso
- RF14 — Seletor de cuidador ("quem está usando o app agora"), sem senha/login
- RN01 — Idoso pode ter vários cuidadores; cuidador pode estar vinculado a mais de um idoso
- RN03 — Toda ação de cadastro/edição registra qual cuidador a realizou (campo de auditoria nos modelos, mesmo que a regra de bloqueio por vínculo — RN02 — venha depois)
- Setup inicial do monorepo (`backend/`, `frontend/`) com boilerplate mínimo: FastAPI + CORS + endpoint de teste; Vite + React + TypeScript + shadcn/ui; Alembic configurado.

**Não inclui (fora de escopo)**
- RN02 (restringir visualização só a cuidadores vinculados) — vem em feature futura de "sessão do cuidador"
- RF05-RF13 (medicamentos, interação, doses) — features seguintes do ciclo SDD
- Autenticação real com senha/login
- Deploy em Vercel/Render (fica para quando o MVP estiver funcional localmente)

## 3) Fluxo atual (como funciona hoje)
Não existe implementação — repositório contém apenas documentação de planejamento (`planejamento.md`, `SDD/`) e nenhum código-fonte. Esta é a primeira feature do projeto.

## 4) Fluxo desejado (comportamento esperado)
1. Usuário abre o app, vê lista de idosos cadastrados (ou tela vazia/"cadastre um idoso").
2. Usuário cadastra um idoso (nome, idade, observações).
3. Usuário cadastra cuidadores e os vincula ao idoso.
4. Um seletor global ("Quem está usando o app agora?") lista os cuidadores vinculados ao idoso ativo; a escolha persiste na sessão do navegador.
5. Toda operação de escrita (criar idoso, criar cuidador, vincular) é associada ao cuidador selecionado no momento (quando aplicável — cadastro do primeiro cuidador de um idoso novo é exceção óbvia, pois ainda não há seleção possível).
6. Erros de validação (nome vazio, telefone inválido, etc.) aparecem como mensagem compreensível na UI, nunca tela branca ou erro cru.

## 5) Mapa do Codebase (onde isso vive)
Projeto greenfield — não há codebase existente para mapear. Estrutura abaixo é a **planejada**, decidida com o usuário nesta sessão, não algo já implementado:

### 5.1 Entradas (rotas/telas/handlers) — planejado
- `backend/app/routers/idosos.py` — endpoints REST de idoso (criar, listar, obter)
- `backend/app/routers/cuidadores.py` — endpoints REST de cuidador (criar, listar, vincular a idoso)
- `frontend/src/pages/` — telas de listagem/cadastro de idoso e cuidador, seletor de cuidador

### 5.2 Domínio / Regras / Serviços — planejado
- `backend/app/services/` — validações de negócio (RN01, RN03) separadas dos routers

### 5.3 Persistência / Modelos / Migrações — planejado
- `backend/app/models/idoso.py`, `backend/app/models/cuidador.py` — SQLAlchemy 2.0 declarative style (`Mapped`/`mapped_column`)
- Tabela de associação idoso↔cuidador (N:N) via `relationship(secondary=...)`
- **Migrations**: Alembic (decisão fechada nesta sessão — projeto usa FastAPI puro, não Flask, então Flask-Migrate não se aplica; Alembic é o equivalente standalone). Primeira migration cria as tabelas `idosos`, `cuidadores` e a tabela de associação.

### 5.4 Integrações externas (clients/adapters/providers)
- Nenhuma nesta feature.

### 5.5 UI / Componentes (se aplicável) — planejado
- shadcn/ui (Tailwind + Radix) via `pnpm dlx shadcn@latest init -t vite`
- Componentes shadcn a instalar conforme necessidade: `form`, `input`, `select` (seletor de cuidador), `card`, `table`/`list`

### 5.6 Testes / Fixtures (se existirem)
- Nenhum teste existe ainda; a definir na fase de Plan (framework de teste do backend/frontend não decidido).

## 6) Padrões existentes para reuso (evitar duplicação)
Não há padrões existentes — este é o código fundacional do projeto. As convenções definidas aqui (estrutura de pastas, camadas, nomenclatura) se tornam o padrão a ser seguido pelas próximas features do ciclo SDD.

## 7) Documentação externa (via Context7)

### Consultas realizadas
| Library ID | Query | Resumo do resultado |
|------------|-------|---------------------|
| `/websites/fastapi_tiangolo` | "bigger applications recommended project structure with routers, dependencies and layered organization" | Estrutura `app/main.py` + `app/routers/*.py` + `app/dependencies.py`, com `APIRouter` incluído no app principal via `include_router` |
| `/websites/sqlalchemy_en_20_orm` | "declarative models many-to-many relationship with association table, SQLAlchemy 2.0 style" | Padrão `DeclarativeBase` + `Mapped`/`mapped_column` + `Table` de associação + `relationship(secondary=...)`, com opção de `back_populates` bidirecional |
| `/websites/ui_shadcn` | "install and configure shadcn/ui in a Vite + React + TypeScript project" | `pnpm dlx shadcn@latest init -t vite` faz o scaffold; setup manual usa `@tailwindcss/vite` plugin + alias `@` no `vite.config.ts` + `components.json` |
| `/websites/alembic_sqlalchemy` | "async engine setup in env.py and autogenerate migration workflow" | Projetos async usam `alembic init -t async` (template async pronto); `env.py` usa `async_engine_from_config` + `asyncio.run`; `target_metadata = Base.metadata` para autogenerate; comando `alembic revision --autogenerate -m "..."` |
| `/websites/fastapi_tiangolo` | "SQLAlchemy async session dependency with dependency injection and Pydantic response models" | Padrão de dependency `get_db()` com `yield` (`try/finally` fecha sessão); `Annotated[Session, Depends(get_db)]` como alias reutilizável; `response_model` do Pydantic filtra o que é exposto na resposta |

### Trechos relevantes
- **SQLAlchemy 2.0 — many-to-many com tabela de associação simples**:
  ```python
  association_table = Table(
      "idoso_cuidador", Base.metadata,
      Column("idoso_id", ForeignKey("idosos.id")),
      Column("cuidador_id", ForeignKey("cuidadores.id")),
  )

  class Idoso(Base):
      __tablename__ = "idosos"
      id: Mapped[int] = mapped_column(primary_key=True)
      cuidadores: Mapped[list["Cuidador"]] = relationship(secondary=association_table, back_populates="idosos")
  ```
- **FastAPI — dependency de sessão de DB**:
  ```python
  async def get_db():
      async with SessionLocal() as db:
          yield db
  ```
- **shadcn/ui — init em projeto Vite existente**:
  ```bash
  pnpm dlx shadcn@latest init -t vite
  ```

## 8) Impactos prováveis (áreas afetadas)
- Setup de projeto: criação de `backend/` e `frontend/` do zero (monorepo, decidido nesta sessão)
- Backend: models, routers, schemas Pydantic, config de DB/CORS, Alembic
- Frontend: scaffold Vite+React+TS, shadcn/ui, telas de cadastro, estado do "cuidador atual"
- Nenhum impacto em código existente (não há)

## 9) Critérios de aceitação
- [ ] É possível cadastrar um idoso com nome, idade e observações
- [ ] É possível cadastrar um cuidador com nome e telefone
- [ ] É possível vincular um cuidador existente a um idoso
- [ ] Um idoso mostra a lista de cuidadores vinculados a ele
- [ ] Existe um seletor de "cuidador atual" acessível na interface
- [ ] Erros de validação (campo vazio, formato inválido) aparecem como mensagem legível, nunca stack trace ou tela branca
- [ ] Falha de conexão com o backend mostra mensagem, não quebra a tela (RNF05)

## 10) Open Questions (bloqueios / dúvidas)
- Onde/como persiste a escolha do "cuidador atual" no frontend (RF14): localStorage do navegador + enviado em cada request (ex: header `X-Cuidador-Id`), ou outro mecanismo?
- SQLAlchemy engine: async (`asyncpg` + `AsyncSession`, alinhado ao padrão async do FastAPI) ou sync (`psycopg2`/`psycopg`, mais simples de depurar em 16h de hackathon)?
- Framework de testes automatizados para backend/frontend (ou nenhum, dado o prazo do hackathon)?
