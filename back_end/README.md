# Backend — LevelUp Study

API REST construída com **Flask**, persistência em **SQLite** via **Flask-SQLAlchemy** e migrações gerenciadas pelo **Flask-Migrate**.

---

## Sumário

- [Tecnologias](#tecnologias)
- [Estrutura](#estrutura)
- [Modelos de dados](#modelos-de-dados)
- [Configuração](#configuração)
- [Migrações](#migrações)
- [Rotas da API](#rotas-da-api)
- [Autenticação](#autenticação)
- [Sistema de XP e níveis](#sistema-de-xp-e-níveis)

---

## Tecnologias

| Pacote | Versão mínima | Uso |
|---|---|---|
| Flask | 2.x | Framework web |
| Flask-SQLAlchemy | 3.x | ORM e conexão com SQLite |
| Flask-Migrate | 4.x | Migrações de banco com Alembic |
| Flask-CORS | 4.x | Permissão de requisições cross-origin |
| Werkzeug | 3.x | Hash de senhas (PBKDF2-SHA256) |

Instale tudo de uma vez:

```bash
pip install -r requirements.txt
```

---

## Estrutura

```
back_end/
├── backend.py          # Ponto de entrada: app, modelos e rotas
├── requirements.txt
├── levelupstudy.db     # Gerado em runtime (ignorado pelo git)
└── migrations/
    ├── env.py          # Configuração do Alembic
    ├── script.py.mako
    └── versions/
        └── 782e9ac7ad12_create_users_user_stats_and_tasks_tables.py
```

---

## Modelos de dados

### User

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | Integer PK | Identificador único |
| `name` | String(100) | Nome do usuário |
| `email` | String(150) UNIQUE | E-mail de login |
| `password_hash` | String(256) | Senha hashada (PBKDF2-SHA256) |
| `created_at` | DateTime | Data de criação |

Relacionamentos: `stats` (1-para-1 com UserStats), `tasks` (1-para-N com Task).

---

### UserStats

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | Integer PK | — |
| `user_id` | FK → users | Usuário dono das stats |
| `xp` | Integer | XP acumulado total |
| `streak` | Integer | Dias consecutivos de estudo |
| `last_study_date` | String(10) | Data do último pomodoro (YYYY-MM-DD) |
| `total_pomodoros` | Integer | Total de pomodoros concluídos |

**Propriedades calculadas** (não armazenadas):

| Propriedade | Cálculo |
|---|---|
| `level` | `max(1, xp // 200 + 1)` |
| `xp_to_next` | `level * 200 - xp` |
| `xp_progress_pct` | `(xp % 200) / 200 * 100` |

---

### Task

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | Integer PK | — |
| `user_id` | FK → users | Dono da tarefa |
| `title` | String(200) | Nome da tarefa |
| `subject` | String(100) | Matéria (opcional) |
| `due_date` | String(10) | Prazo no formato YYYY-MM-DD |
| `priority` | Integer | 1 = alta · 2 = média · 3 = baixa |
| `done` | Boolean | Se foi concluída |
| `created_at` | DateTime | Data de criação |

---

## Configuração

A aplicação lê as seguintes variáveis de ambiente:

| Variável | Padrão | Descrição |
|---|---|---|
| `SECRET_KEY` | `dev-secret-change-in-production` | Chave de assinatura da sessão — **mude em produção** |

Exemplo:

```bash
export SECRET_KEY="sua-chave-segura-aqui"
python backend.py
```

---

## Migrações

O banco é gerenciado pelo **Flask-Migrate** (Alembic). Comandos úteis:

```bash
# Aplicar todas as migrações pendentes (uso normal)
flask db upgrade

# Criar uma nova migração após alterar os modelos
flask db migrate -m "descrição da mudança"

# Ver histórico de migrações
flask db history

# Voltar uma migração
flask db downgrade
```

> Defina `FLASK_APP=backend.py` antes de usar os comandos `flask db`.

---

## Rotas da API

Base URL: `http://localhost:5000/api`

Todas as rotas (exceto `/auth/register` e `/auth/login`) exigem sessão autenticada. Requisições sem sessão retornam `401 Não autenticado`.

---

### Autenticação

#### `POST /auth/register`

Cria uma nova conta e inicia a sessão.

**Body:**
```json
{
  "name": "Ana Karolina",
  "email": "ana@email.com",
  "password": "minhasenha123"
}
```

**Resposta 201:**
```json
{
  "user":  { "id": 1, "name": "Ana Karolina", "email": "ana@email.com" },
  "stats": { "xp": 0, "level": 1, "streak": 0, ... }
}
```

**Erros:** `400` campos faltando ou senha < 6 chars · `409` e-mail já cadastrado.

---

#### `POST /auth/login`

Autentica o usuário e inicia a sessão.

**Body:**
```json
{ "email": "ana@email.com", "password": "minhasenha123" }
```

**Resposta 200:**
```json
{
  "user":  { "id": 1, "name": "Ana Karolina", "email": "ana@email.com" },
  "stats": { "xp": 150, "level": 1, "streak": 3, ... }
}
```

**Erros:** `401` credenciais incorretas.

---

#### `POST /auth/logout`

Encerra a sessão atual.

**Resposta 200:** `{ "ok": true }`

---

#### `GET /auth/me`

Retorna o usuário e stats da sessão ativa. Usado pelo frontend para verificar autenticação.

**Resposta 200:**
```json
{
  "user":  { "id": 1, "name": "Ana Karolina", "email": "ana@email.com" },
  "stats": { "xp": 150, "level": 1, "streak": 3, "total_pomodoros": 3,
             "xp_to_next": 50, "xp_progress_pct": 75 }
}
```

---

### Progresso

#### `GET /status`

Retorna as stats completas do usuário autenticado.

**Resposta 200:**
```json
{
  "xp": 200,
  "level": 2,
  "streak": 5,
  "last_study_date": "2026-06-10",
  "total_pomodoros": 4,
  "xp_to_next": 200,
  "xp_progress_pct": 0
}
```

---

#### `POST /pomodoro/complete`

Registra um pomodoro concluído. Atualiza XP, streak e total de pomodoros.

**Lógica do streak:**
- Mesmo dia → streak mantido
- Dia anterior → streak incrementado
- Qualquer outro → streak reinicia em 1

**Resposta 200:**
```json
{
  "xp_gained": 50,
  "total_xp": 250,
  "level": 2,
  "streak": 6,
  "xp_to_next": 150,
  "xp_progress_pct": 25
}
```

---

### Tarefas

#### `GET /tasks`

Lista todas as tarefas do usuário. Ordenadas por: não concluídas primeiro → prioridade → prazo.

**Resposta 200:**
```json
[
  { "id": 1, "title": "Estudar Matemática", "subject": "Matemática",
    "due_date": "2026-06-15", "priority": 1, "done": false },
  ...
]
```

---

#### `POST /tasks`

Cria uma nova tarefa.

**Body:**
```json
{
  "title":    "Estudar Física",
  "subject":  "Física",
  "due_date": "2026-06-20",
  "priority": 2
}
```

**Resposta 201:** objeto da tarefa criada.  
**Erros:** `400` título vazio.

---

#### `POST /tasks/:id/complete`

Marca uma tarefa como concluída e concede **30 XP**.

**Resposta 200:**
```json
{ "xp_gained": 30, "total_xp": 280, "level": 2, "xp_progress_pct": 40 }
```

**Erros:** `404` tarefa não encontrada ou já concluída.

---

#### `DELETE /tasks/:id`

Remove uma tarefa permanentemente.

**Resposta 200:** `{ "ok": true }`

---

### Sugestão

#### `GET /suggest`

Retorna a tarefa pendente mais urgente com base em prazo e prioridade.

**Resposta 200 (com tarefas):**
```json
{
  "suggestion": { "id": 1, "title": "Estudar Física", ... },
  "message": "Comece por: Estudar Física"
}
```

**Resposta 200 (sem tarefas):**
```json
{ "suggestion": null, "message": "Nenhuma tarefa pendente! Adicione novas tarefas." }
```

---

## Sistema de XP e níveis

| Ação | XP ganho |
|---|---|
| Pomodoro concluído | +50 XP |
| Tarefa concluída | +30 XP |

| Constante | Valor |
|---|---|
| XP por nível | 200 XP |
| Fórmula do nível | `max(1, xp // 200 + 1)` |

**Exemplos:**

| XP | Nível |
|---|---|
| 0 – 199 | 1 |
| 200 – 399 | 2 |
| 400 – 599 | 3 |
| 1000 – 1199 | 6 |
