# LevelUp Study

Sistema de controle de atenção e hábitos de estudo baseado em gamificação. O objetivo é ajudar estudantes a manter foco, se organizar e criar consistência nos estudos por meio de mecânicas de jogo: XP, níveis, streaks e conquistas.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Como rodar](#como-rodar)
- [Fluxo de uso](#fluxo-de-uso)
- [Documentação detalhada](#documentação-detalhada)

---

## Visão geral

```
Estudante abre o app
        │
        ▼
   Cria conta / faz login
        │
        ▼
   Dashboard principal
   ┌────────────────────────────────┐
   │  Timer Pomodoro  │  Sugestão  │
   │  Tarefas         │  Stats     │
   │  Conquistas      │  Temas     │
   └────────────────────────────────┘
        │
        ▼
   Estuda → ganha XP → sobe de nível → mantém streak
```

O ciclo **foco → recompensa → motivação → continuidade** é o diferencial do sistema: não é apenas um app de tarefas ou um timer isolado.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Autenticação** | Cadastro e login com senha hash (PBKDF2-SHA256), sessão por cookie |
| **Pomodoro** | Timer configurável (25/5, 50/10, 15/3, 45/15 min), anel de progresso SVG, beep sonoro |
| **Tarefas** | CRUD completo com prioridade, matéria e prazo |
| **Sugestão inteligente** | Indica automaticamente a tarefa mais urgente com base em prazo e prioridade |
| **Gamificação** | XP por pomodoro e tarefa concluída, níveis, streak diário |
| **Conquistas** | 11 badges desbloqueáveis por metas de XP, nível, pomodoros e streak |
| **Temas** | 6 temas visuais (Dark, Ocean, Forest, Sunset, Light, Midnight), persistidos em localStorage |

---

## Estrutura do projeto

```
Desafio-LJ/
├── back_end/
│   ├── backend.py          # API Flask — modelos, rotas, lógica
│   ├── requirements.txt    # Dependências Python
│   └── migrations/         # Migrações Alembic (Flask-Migrate)
│       └── versions/
│           └── 782e9ac7ad12_create_users_user_stats_and_tasks_tables.py
├── front_end/
│   ├── index.html          # Dashboard principal (requer autenticação)
│   ├── login.html          # Tela de login
│   └── register.html       # Tela de cadastro
├── .gitignore
└── README.md
```

---

## Requisitos

- Python 3.10+
- pip

---

## Como rodar

### 1. Instalar dependências

```bash
cd back_end
pip install -r requirements.txt
```

### 2. Aplicar as migrações (cria o banco de dados)

```bash
cd back_end
flask db upgrade
```

> O arquivo `levelupstudy.db` será criado automaticamente na pasta `back_end/`.

### 3. Iniciar o servidor

```bash
python backend.py
```

O backend ficará disponível em `http://localhost:5000`.

### 4. Abrir o frontend

Abra `front_end/login.html` diretamente no navegador ou sirva a pasta com qualquer servidor estático:

```bash
# Exemplo com Python
python -m http.server 5500 --directory front_end
# Depois acesse: http://localhost:5500/login.html
```

---

## Fluxo de uso

1. Acesse `login.html` → crie uma conta em `register.html`
2. Após o login você é redirecionado para o **Dashboard**
3. Use a barra lateral para navegar entre as seções
4. Inicie um Pomodoro → ao concluir, ganhe **50 XP**
5. Adicione tarefas na seção **Tarefas** e conclua-as para ganhar **30 XP** cada
6. Acompanhe nível, streak e conquistas desbloqueadas
7. Troque o tema em **Configurações → Temas**

---

## Documentação detalhada

- [Documentação do Backend](back_end/README.md)
- [Documentação do Frontend](front_end/README.md)
