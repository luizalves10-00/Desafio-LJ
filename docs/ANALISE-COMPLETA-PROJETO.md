# 📊 Análise Completa e Exaustiva do Projeto — LevelUp Study

> **Documento Gerado:** Análise Técnica, Arquitetural, de Negócio e Mapeamento Integral de Arquivos  
> **Data:** Setembro de 2026  
> **Projeto:** LevelUp Study — *“Organização e foco nos estudos”*  
> **Equipe:** Equipe LAWS (Luiz Fellipe Amaral, Ana Karolina Castro, William Brito, Samuel Teles)  
> **Competição:** Desafio Liga Jovem (DLJ 4ª Edição) — Sebrae & Instituto IDF  
> **Categoria:** Tecnologia · Educação | Eixo: Eu, Eu e o Outro, Eu e o Mundo  
> **ODS Vinculados:** ODS 4 (Educação de Qualidade), ODS 3 (Saúde e Bem-Estar), ODS 10 (Redução das Desigualdades)

---

## 📑 Sumário

1. [Visão Geral e Proposta de Valor](#1-visão-geral-e-proposta-de-valor)
2. [Identidade da Equipe (Equipe LAWS)](#2-identidade-da-equipe-equipe-laws)
3. [Mapeamento Integral de Arquivos (Sem Omissões)](#3-mapeamento-integral-de-arquivos-sem-omissões)
   - 3.1. [Arquivos na Raiz do Workspace](#31-arquivos-na-raiz-do-workspace)
   - 3.2. [Raiz do Projeto (Desafio-LJ/)](#32-raiz-do-projeto-desafio-lj)
   - 3.3. [Back-end (Desafio-LJ/back_end/)](#33-back-end-desafio-ljback_end)
   - 3.4. [Migrações de Banco (Desafio-LJ/back_end/migrations/)](#34-migrações-de-banco-desafio-ljback_endmigrations)
   - 3.5. [Deploy e Infraestrutura (Desafio-LJ/deploy/)](#35-deploy-e-infraestrutura-desafio-ljdeploy)
   - 3.6. [Configurações de Desenvolvimento (Desafio-LJ/dev-config/)](#36-configurações-de-desenvolvimento-desafio-ljdev-config)
   - 3.7. [Documentos de Negócio e Deploy (Desafio-LJ/docs/)](#37-documentos-de-negócio-e-deploy-desafio-ljdocs)
   - 3.8. [Documentos do Desafio Liga Jovem (Desafio-LJ/docs_desafio/)](#38-documentos-do-desafio-liga-jovem-desafio-ljdocs_desafio)
   - 3.9. [Ferramentas Internas de Apoio (Desafio-LJ/ferramentas/)](#39-ferramentas-internas-de-apoio-desafio-ljferramentas)
   - 3.10. [Front-end (Desafio-LJ/front_end/)](#310-front-end-desafio-ljfront_end)
   - 3.11. [Assets e Emojis 3D (Desafio-LJ/front_end/assets/)](#311-assets-e-emojis-3d-desafio-ljfront_endassets)
   - 3.12. [Testes do Front-end (Desafio-LJ/front_end/tests/)](#312-testes-do-front-end-desafio-ljfront_endtests)
   - 3.13. [Scripts do Projeto (Desafio-LJ/scripts/)](#313-scripts-do-projeto-desafio-ljscripts)
   - 3.14. [Apresentação e Pitch Deck (Desafio-LJ/slides/)](#314-apresentação-e-pitch-deck-desafio-ljslides)
4. [Arquitetura de Software e Fluxo de Dados](#4-arquitetura-de-software-e-fluxo-de-dados)
5. [Mecânicas de Gamificação e RPG](#5-mecânicas-de-gamificação-e-rpg)
6. [Arcade da Pausa (18 Minijogos e Sistema Anti-Vício)](#6-arcade-da-pausa-18-minijogos-e-sistema-anti-vício)
7. [Inteligência Artificial Contextualizada (Google Gemini)](#7-inteligência-artificial-contextualizada-google-gemini)
8. [Sub-sistema de Emojis 3D e Cache Otimizado](#8-sub-sistema-de-emojis-3d-e-cache-otimizado)
9. [Modelo de Negócio e Estratégia de Apresentação (Pitch)](#9-modelo-de-negócio-e-estratégia-de-apresentação-pitch)
10. [Plano de Deploy e Infraestrutura em Nuvem](#10-plano-de-deploy-e-infraestrutura-em-nuvem)
11. [Síntese e Considerações Finais](#11-síntese-e-considerações-finais)

---

## 1. Visão Geral e Proposta de Valor

O **LevelUp Study** é uma plataforma web educacional concebida para solucionar o maior gargalo enfrentado por estudantes modernos: **a dificuldade em manter a constância e a disciplina nos estudos em um ambiente repleto de distrações digitais**.

### O Diagnóstico do Problema
- **Distração Digital Constante:** O smartphone é a principal fonte de distração; pausas de estudo de 5 minutos rotineiramente degeneram em dezenas de minutos perdidos em redes sociais (TikTok, Instagram, Shorts).
- **Paralisia por Desorganização:** Estudantes acumulam tarefas sem saber por qual começar, o que gera procrastinação por sobrecarga cognitiva.
- **Evolução Invisível:** Ao contrário dos jogos eletrônicos, o estudo tradicional não oferece feedback imediato de progresso, desmotivando o aluno no médio prazo.
- **Fragmentação de Ferramentas:** Alunos tentam usar soluções desconectadas (agenda de papel, Trello/Todoist para tarefas e timers Pomodoro isolados). Nenhum app conversa entre si.

### A Solução: O Ciclo Fechado
O grande diferencial do LevelUp Study em relação aos concorrentes é o **Ciclo Fechado**:
$$\text{Foco (Pomodoro + Batalha)} \longrightarrow \text{Organização (Missões + Rota)} \longrightarrow \text{Recompensa (EXP, Níveis, Streaks)} \longrightarrow \text{Retenção}$$

1. **Controle de Atenção:** Timer Pomodoro integrado com 4 modos temporais (25/5, 50/10, 15/3, 45/15 min) e batalha temática contra os "Monstros da Distração".
2. **Organização Inteligente:** Lista de tarefas tratadas como "Missões" com classificação por matéria, prazo e peso de RPG (Chefe, Elite, Normal), apoiada por um algoritmo de ordenação e pelo botão *"O que fazer agora?"*.
3. **Gamificação Real (RPG):** Acúmulo de EXP, progressão em níveis, manutenção de dias consecutivos (*streaks*), distribuição de atributos (Força, Sabedoria, Disciplina), 7 classes de herói e 33 conquistas colecionáveis com 4 níveis de raridade.
4. **Vantagem Injusta na Pausa:** Durante o intervalo, em vez de o aluno abrir redes sociais viciantes, o app oferece um **Arcade nativo com 18 minijogos**. Para evitar que o jogo se torne uma nova distração, há um mecanismo rigoroso de **Cooldown Proporcional (Autolimite)**: o tempo jogado além do intervalo é bloqueado na proporção de 1 para 1.

---

## 2. Identidade da Equipe (Equipe LAWS)

O acrônimo **LAWS** é formado pelas iniciais dos quatro desenvolvedores e idealizadores do projeto:

| Membro | Função Principal | Contribuição Específica no Projeto | Perfil / Contato |
|---|---|---|---|
| **Ana Karolina Castro** | Full Stack Developer | Desenvolvimento do Dashboard, sistema de temas visuais, arquitetura de progressão de RPG e implementação dos 18 minijogos do Arcade. | [github.com/karol1208](https://github.com/karol1208) · `ana.k.castro8@aluno.senai.br` |
| **Luiz Fellipe Amaral** | Back-end · IA · Infraestrutura | Arquitetura da API REST em Flask, modelagem relacional de dados, regras de negócio de EXP/streaks, integração do Gemini 2.5 Flash e deploy. | [github.com/luizalves10-00](https://github.com/luizalves10-00) · `luiz.alves10@aluno.senai.br` |
| **William Brito** | Full Stack Developer | Desenvolvimento front-end, back-end e banco de dados, com liderança em Design de Interface (UI), experiência do usuário (UX) e design system. | [github.com/williambritodev12](https://github.com/williambritodev12) |
| **Samuel Teles** | Full Stack · Banco de Dados | Modelagem de dados, administração do SQLite, criação e manutenção das migrações Alembic e lógica full stack integrada. | [github.com/Sammytss](https://github.com/Sammytss) |

---

## 3. Mapeamento Integral de Arquivos (Sem Omissões)

Esta seção cataloga e analisa minuciosamente **cada arquivo** existente no workspace, detalhando seu propósito técnico e conteúdo.

```
dev_level/
├── emoji-audit-data.json
├── fluent-tree.json
├── inventario-emojis.md
├── pdf-text-audit.json
└── Desafio-LJ/
    ├── .gitignore
    ├── README.md
    ├── back_end/
    │   ├── backend.py
    │   ├── EMOJIS.md
    │   ├── emoji_cache.py
    │   ├── levelupstudy.db
    │   ├── README.md
    │   ├── requirements.txt
    │   ├── test_emoji_cache.py
    │   ├── emoji-cache/
    │   │   ├── cache.sqlite3
    │   │   └── [pngs de emojis sob demanda]
    │   └── migrations/
    │       ├── alembic.ini
    │       ├── env.py
    │       ├── README
    │       ├── script.py.mako
    │       └── versions/
    │           ├── 782e9ac7ad12_create_users_user_stats_and_tasks_tables.py
    │           ├── 5b0743a9e864_add_interests_to_user.py
    │           └── c88f64ed817a_add_game_xp_today_and_game_xp_date_to_.py
    ├── deploy/
    │   ├── hestia/
    │   │   ├── levelup-study.tpl
    │   │   └── levelup-study.stpl
    │   └── systemd/
    │       └── levelup-study.service.example
    ├── dev-config/
    │   └── launch.json
    ├── docs/
    │   ├── ANALISE-COMPLETA-PROJETO.md  <-- [Este Arquivo]
    │   ├── Canvas.jpeg
    │   ├── DEPLOY-ORACLE-HESTIA.md
    │   ├── informações do projeto cadastrado na plataforma detalhes.pdf
    │   └── informações do projeto cadastrado na plataforma.pdf
    ├── docs_desafio/
    │   ├── abertura.pdf
    │   ├── banca_estadual.pdf
    │   ├── bmc
    │   ├── bmc.html
    │   ├── Desafio.pdf
    │   ├── mentoria_estadual
    │   ├── mvp
    │   ├── ods.pdf
    │   ├── Pitch
    │   ├── protipagem.pdf
    │   └── tipos_de_projetos.pdf
    ├── ferramentas/
    │   ├── .gitignore
    │   ├── launch.json
    │   ├── pdf_extrair_imagens.py
    │   ├── pdf_para_svg.py
    │   └── README.md
    ├── front_end/
    │   ├── emoji-3d.css
    │   ├── emoji-3d.js
    │   ├── emoji-catalog.js
    │   ├── index.css
    │   ├── index.html
    │   ├── index.js
    │   ├── landing.css
    │   ├── landing.html
    │   ├── landing.js
    │   ├── login.css
    │   ├── login.html
    │   ├── login.js
    │   ├── README.md
    │   ├── register.css
    │   ├── register.html
    │   ├── register.js
    │   ├── assets/
    │   │   ├── corrida.png
    │   │   ├── pulo.png
    │   │   ├── vitoria.png
    │   │   ├── LEIA-ME.txt
    │   │   └── emoji/
    │   │       ├── CREDITOS.md
    │   │       ├── LICENSE
    │   │       ├── manifest.json
    │   │       └── [97 arquivos PNG 3D locais]
    │   └── tests/
    │       ├── emoji-3d.html
    │       └── emoji-remoto.html
    ├── scripts/
    │   └── baixar-emojis.mjs
    └── slides/
        └── pitch-levelup-study.html
```

---

### 3.1. Arquivos na Raiz do Workspace

- **`emoji-audit-data.json` (3.119.847 bytes):**
  Estrutura JSON gerada para auditar todas as ocorrências de símbolos Unicode e glifos nos códigos-fonte, documentações e arquivos estáticos. Mapeia chaves como `hits`, `symbols`, `scanned` e `binary`, rastreando códigos hexadecimais, caracteres compostos e referências exatas em cada arquivo.
- **`fluent-tree.json` (6.844.719 bytes):**
  Árvore completa de objetos Git (`sha`, `url`, `tree`) extraída diretamente da API do repositório oficial da Microsoft (`microsoft/fluentui-emoji`). Permite ao projeto localizar de forma precisa e determinística as artes originais de emojis 3D em alta resolução (pasta `3D/` e `Default/`).
- **`inventario-emojis.md` (308.108 bytes):**
  Relatório técnico gerado em 08/09/2026. Registra 502 ocorrências de emojis em 9 arquivos de texto do projeto, totalizando 139 emojis únicos agrupados por equivalência com e sem seletor de variação `U+FE0F`. Apresenta tabela com a contagem por arquivo e a localização exata de cada emoji por linha e coluna.
- **`pdf-text-audit.json` (27.648 bytes):**
  Auditoria dos arquivos PDF do projeto. Registra o conteúdo textual extraível de cada documento. Revela que os PDFs submetidos na plataforma foram gerados via *Microsoft: Print To PDF* (vetores sem texto embutido), enquanto os documentos oficiais do Sebrae (`banca_estadual.pdf`, `Desafio.pdf`, `ods.pdf`, etc.) contêm texto indexado com detalhes cruciais das regras da competição.

---

### 3.2. Raiz do Projeto (`Desafio-LJ/`)

- **`.gitignore` (400 bytes):**
  Define os arquivos e diretórios que não devem ser rastreados pelo controle de versão Git: ambientes virtuais (`.venv/`, `venv/`), arquivos de bytecode Python (`__pycache__/`, `*.pyc`), variáveis de ambiente locais contendo segredos (`.env`), banco SQLite local (`levelupstudy.db`, `cache.sqlite3`), logs do servidor e caches de download transitórios (`emoji-cache/`).
- **`README.md` (4.048 bytes):**
  Apresentação central do projeto para a comunidade e avaliadores. Contém sumário executivo, diagrama de fluxo do ciclo de estudo, tabela de funcionalidades dos módulos, mapa da árvore de diretórios, requisitos (Python 3.10+), comandos de instalação (`pip install -r requirements.txt`, `flask db upgrade`, `python backend.py`), instruções de execução do front-end e links para as documentações específicas de front-end e back-end.

---

### 3.3. Back-end (`Desafio-LJ/back_end/`)

- **`backend.py` (19.858 bytes):**
  Núcleo da API REST em Flask. Integra:
  - Inicialização do Flask, SQLAlchemy, Migrate e CORS habilitado com `supports_credentials=True`.
  - Carregamento de segredos via `python-dotenv`.
  - Constantes de regras de negócio: `XP_PER_POMODORO = 50`, `XP_PER_TASK = 30`, pesos por prioridade (`1: 40`, `2: 30`, `3: 20`), `XP_PER_LEVEL = 200`, `GAME_XP_MAX_PER_CALL = 50` e teto diário `GAME_XP_DAILY_CAP = 150`.
  - Modelos ORM: `User`, `UserStats` e `Task`.
  - Rotas de autenticação com cookies seguros (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`).
  - Rotas de progresso e gamificação (`/api/status`, `/api/pomodoro/complete` com algoritmo de verificação de dias consecutivos para cálculo de streak, `/api/game/reward` com limitação diária anti-fraude).
  - Rotas de tarefas (`GET /api/tasks`, `POST /api/tasks`, `POST /api/tasks/<id>/complete`, `DELETE /api/tasks/<id>`).
  - Rota de sugestão inteligente (`GET /api/suggest`) que ordena tarefas por prazo e prioridade.
  - Rotas de IA com Google Gemini (`GET /api/ai/routine` e `POST /api/ai/chat`) que injetam os interesses do perfil do usuário em tempo de execução.
  - Blueprint do cache de emojis 3D (`/api/emoji/<code>.png`).
  - Servidor de arquivos estáticos para unificar front-end e back-end na mesma porta em ambientes de desenvolvimento e produção.
- **`emoji_cache.py` (8.086 bytes):**
  Serviço de cache local com armazenamento persistente em SQLite para emojis 3D da biblioteca Fluent:
  - Validação estrita de sequências Unicode através da biblioteca `emoji` e regex segura contra *path traversal*.
  - Cliente HTTP customizado com desativação deliberada de redirecionamentos (`NoRedirect`) apontando exclusivamente para o host de confiança `www.emoji.family`.
  - Sanitização e reprocessamento com Pillow (PIL): decodifica a imagem PNG, descarta metadados/payloads maliciosos, valida dimensões (128x128 até 512x512) e grava novo PNG otimizado RGBA.
  - Limite de taxa de 30 downloads por minuto e teto global de armazenamento de 200 MiB no banco SQLite local.
- **`test_emoji_cache.py` (6.877 bytes):**
  Conjunto de testes automatizados com `unittest`:
  - `test_exact_sequences_and_invalid_inputs`: Valida codificação e bloqueio de entradas maliciosas (`../secret`, URLs, hexadecimais inválidos).
  - `test_disk_cache_survives_new_instance`: Confirma que o cache em disco sobrevive ao reinício da aplicação.
  - `test_bundled_does_not_use_network_or_auth`: Garante que emojis locais não fazem requisição externa.
  - `test_auth_prevents_new_download`: Assegura que apenas usuários autenticados podem disparar downloads de novos emojis.
  - `test_concurrent_misses_are_deduplicated`: Testa resolução concorrente em múltiplas threads prevenindo downloads duplicados.
  - `test_http_cache_headers_and_conditional_requests`: Verifica cabeçalhos HTTP (`nosniff`, `max-age=31536000`, `ETag`, `304 Not Modified`).
- **`EMOJIS.md` (3.628 bytes):**
  Documentação técnica explicativa da arquitetura do cache de emojis: por que não baixar milhares de imagens de uma vez, como funciona a proteção à privacidade dos dados de chat e parâmetros operacionais de segurança.
- **`requirements.txt` (136 bytes):**
  Especificação das dependências Python:
  ```text
  flask
  flask-cors
  flask-sqlalchemy
  flask-migrate
  werkzeug
  google-genai
  python-dotenv
  emoji>=2,<3
  Pillow>=12.3,<13
  gunicorn>=23,<24
  ```
- **`levelupstudy.db` (24.576 bytes):**
  Instância local do banco de dados relacional SQLite, estruturada com as tabelas `alembic_version`, `users`, `user_stats` e `tasks`.
- **`emoji-cache/cache.sqlite3`:**
  Banco de dados SQLite auxiliar gerenciado por `emoji_cache.py`. Armazena o estado das entradas (`entries`: chave, status HTTP, retry_at, tamanho em bytes), histórico de tentativas (`attempts`) e configurações globais de cooldown (`settings`).
- **`emoji-cache/*.png`:**
  Arquivos de imagem cacheados dinamicamente pelo back-end sob demanda (ex: `1f355.png` - pizza, `1f44b.png` - mão acenando, `1f469-200d-1f680.png` - astronauta mulher, `1f98a.png` - raposa).
- **`README.md` (7.704 bytes):**
  Guia aprofundado do back-end: documentação completa dos endpoints da API (corpos de requisição, respostas JSON de sucesso e códigos de erro), schemas das tabelas do banco de dados, propriedades computadas e comandos de manutenção via Flask-Migrate.

---

### 3.4. Migrações de Banco (`Desafio-LJ/back_end/migrations/`)

- **`alembic.ini`:** Arquivo padrão de inicialização e configuração do Alembic para o SQLAlchemy.
- **`env.py`:** Script de execução do Alembic que vincula o contexto da aplicação Flask e os metadados do `db.Model` para detecção de alterações nas tabelas.
- **`README`:** Instruções originais do repositório Alembic/Flask-Migrate.
- **`script.py.mako`:** Template para geração automática de novos scripts de migração Python.
- **`versions/782e9ac7ad12_create_users_user_stats_and_tasks_tables.py` (2.202 bytes):**
  Migração inicial que cria as tabelas essenciais:
  - `users`: `id`, `name`, `email`, `password_hash`, `created_at`.
  - `user_stats`: `id`, `user_id`, `xp`, `streak`, `last_study_date`, `total_pomodoros`.
  - `tasks`: `id`, `user_id`, `title`, `subject`, `due_date`, `priority`, `done`, `created_at`.
- **`versions/5b0743a9e864_add_interests_to_user.py` (2.402 bytes):**
  Migração que adiciona a coluna `interests` (VARCHAR(500)) na tabela `users`, permitindo que os interesses do estudante sejam persistidos e consumidos pelos prompts da IA.
- **`versions/c88f64ed817a_add_game_xp_today_and_game_xp_date_to_.py` (1.014 bytes):**
  Migração que adiciona os campos `game_xp_today` (INTEGER) e `game_xp_date` (VARCHAR(10)) à tabela `user_stats` para implementar o teto diário de pontuação dos minijogos.

---

### 3.5. Deploy e Infraestrutura (`Desafio-LJ/deploy/`)

- **`deploy/hestia/levelup-study.tpl`:**
  Template Nginx para HTTP na porta 80 do painel HestiaCP. Realiza proxy reverso transparente para o Gunicorn rodando localmente na porta interna `127.0.0.1:8017`, repassando cabeçalhos `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto`.
- **`deploy/hestia/levelup-study.stpl`:**
  Template Nginx para HTTPS na porta 443 do painel HestiaCP. Configura certificados SSL/TLS, ativa HTTP/2, define configurações de cache para assets estáticos e efetua o proxy reverso seguro para a aplicação.
- **`deploy/systemd/levelup-study.service.example` (559 bytes):**
  Arquivo de configuração do systemd para execução do Gunicorn como daemon de serviço Linux no servidor:
  ```ini
  [Unit]
  Description=LevelUp Study (Gunicorn)
  After=network.target

  [Service]
  Type=simple
  User=USUARIO_HESTIA
  Group=USUARIO_HESTIA
  WorkingDirectory=/home/USUARIO_HESTIA/apps/levelup-study/current/back_end
  EnvironmentFile=/home/USUARIO_HESTIA/apps/levelup-study/shared/.env
  ExecStart=/home/USUARIO_HESTIA/apps/levelup-study/current/.venv/bin/gunicorn --workers 2 --threads 2 --timeout 90 --bind 127.0.0.1:8017 --access-logfile - --error-logfile - backend:app
  Restart=always
  RestartSec=5
  PrivateTmp=true
  NoNewPrivileges=true

  [Install]
  WantedBy=multi-user.target
  ```

---

### 3.6. Configurações de Desenvolvimento (`Desafio-LJ/dev-config/`)

- **`dev-config/launch.json`:**
  Configuração padrão para o Visual Studio Code / editores baseados no protocolo DAP, permitindo a execução rápida do backend com depuração integrada em ambiente de desenvolvimento.

---

### 3.7. Documentos de Negócio e Deploy (`Desafio-LJ/docs/`)

- **`ANALISE-COMPLETA-PROJETO.md`:**
  *Este documento.* Consolidação completa e detalhada da arquitetura, negócio, código, apresentações e planos de futuro do LevelUp Study.
- **`Canvas.jpeg` (319.190 bytes):**
  Arquivo de imagem contendo a foto do Lean Canvas elaborado pela equipe LAWS durante as etapas de ideação do Desafio Liga Jovem. Estrutura os 9 blocos do modelo de negócio (Problema, Solução, Proposta de Valor, Vantagem Injusta, Segmentos, Canais, Métricas-Chave, Estrutura de Custos e Fontes de Receita).
- **`DEPLOY-ORACLE-HESTIA.md` (10.024 bytes):**
  Manual passo a passo abrangente e prático para hospedar o LevelUp Study na nuvem gratuita da Oracle Cloud (Compute Instance Always Free) gerenciada pelo painel HestiaCP. Detalha regras de firewall da VCN da Oracle, liberação de portas (80, 443), apontamentos DNS (`registro A`), isolamento de usuário Linux, criação de ambiente virtual Python, configuração de variáveis de ambiente seguras (`.env`), instalação dos templates Nginx e configuração do daemon systemd.
- **`informações do projeto cadastrado na plataforma.pdf` (3.142.781 bytes):**
  Documento de submissão do projeto na plataforma oficial do Desafio Liga Jovem. Contém as respostas submetidas pela equipe nas etapas classificatórias, abrangendo problema, público-alvo, solução e primeiros testes.
- **`informações do projeto cadastrado na plataforma detalhes.pdf` (5.164.400 bytes):**
  Versão expandida da submissão na plataforma, com detalhamento das etapas de validação, planejamento financeiro preliminar e planejamento de prototipagem funcional.

---

### 3.8. Documentos do Desafio Liga Jovem (`Desafio-LJ/docs_desafio/`)

- **`abertura.pdf`:**
  Apresentação institucional de abertura do Desafio Liga Jovem 4, com orientações gerais aos estudantes e cronograma macro do evento.
- **`banca_estadual.pdf`:**
  Manual e regulamento oficial da etapa de **Banca Estadual Online**:
  - Critérios de participação: 6 melhores equipes de cada categoria por estado (486 equipes no total nacional).
  - Formato: Apresentação ao vivo de 5 minutos no Google Meet + 5 minutos de arguição pelos jurados + 10 minutos de feedback.
  - Bancas compostas por 3 a 6 jurados.
  - Regra de ouro: Apresentação em formato PDF obrigatoriamente enviada para `ligajovem@institutoidf.org` até as 10:00 da manhã do dia da banca.
  - Os 5 critérios de avaliação oficiais (pontuação de 1 a 5 com pesos iguais):
    1. *Entendimento do público-alvo*
    2. *Criatividade e Inovação*
    3. *Impacto no dia a dia da comunidade*
    4. *Viabilidade e planejamento financeiro*
    5. *Protótipo*
- **`bmc` (3.888 bytes):**
  Texto de apoio da formação do Sebrae sobre a metodologia do Business Model Canvas (BMC), explicando a lógica de cada um dos 9 blocos estratégicos e linkando vídeo tutorial no YouTube.
- **`bmc.html`:**
  Versão visual e responsiva do material de Business Model Canvas, adaptada esteticamente com a tipografia do projeto e enriquecida com os emojis 3D locais.
- **`Desafio.pdf`:**
  Caderno pedagógico dos três eixos formativos do Liga Jovem:
  - *Eixo 1 (Eu):* Autoconhecimento, identificação de talentos e competências para a vida.
  - *Eixo 2 (Eu e o Outro):* Trabalho em equipe, empatia, comunicação e mobilização social.
  - *Eixo 3 (Eu e o Mundo):* Olhar para a comunidade, agir com propósito e alinhar soluções aos Objetivos de Desenvolvimento Sustentável (ODS) da ONU.
- **`mentoria_estadual` (261 bytes):**
  Registro da mentoria estadual realizada em 06 de agosto para a categoria fundamental, com link oficial de gravação no YouTube.
- **`mvp` (1.097 bytes):**
  Roteiro formativo do Sebrae Talks sobre Mínimo Produto Viável (MVP), abordando tipologias (protótipo, teste A/B, "Mágico de Oz"), armadilhas de perfeccionismo e foco em aprendizado iterativo.
- **`ods.pdf`:**
  Guia rápido da ONU e Sebrae sobre os 17 Objetivos de Desenvolvimento Sustentável (Agenda 2030), detalhando sua integração no ecossistema brasileiro e na COP30 em Belém do Pará.
- **`Pitch` (870 bytes):**
  Checklist oficial do roteiro de pitch exigido pelo Sebrae:
  1. *Capa:* Nome da solução e apresentador.
  2. *Problema claro:* Dor real e relevante.
  3. *Público-alvo:* Quem é afetado e por quê.
  4. *Solução:* O que criaram e como funciona.
  5. *Inovação / Diferencial:* O que torna a ideia única.
  6. *Protótipo:* Demonstração visual e funcional.
  7. *Viabilidade / Custo-benefício:* Implantação e retorno.
  8. *Impacto:* O que muda na prática.
  9. *Equipe:* Nome, foto e função.
  10. *Encerramento:* Agradecimento, CTA e contato.
- **`protipagem.pdf`:**
  Guia instrucional sobre prototipagem rápida e validação de baixo custo (desenhos, simulações em vídeo, design de telas no Canva e MVPs interativos).
- **`tipos_de_projetos.pdf`:**
  Classificação das soluções aceitas no Liga Jovem: Produto físico, Serviço/Processo ou Aplicativo/Site digital.

---

### 3.9. Ferramentas Internas de Apoio (`Desafio-LJ/ferramentas/`)

- **`ferramentas/.gitignore`:**
  Ignora diretórios temporários gerados pelas ferramentas de processamento de imagem e extração vetorial (`saida/`, `imagens/`).
- **`ferramentas/launch.json`:**
  Configuração para subida de servidor HTTP local leve na porta `5599` para visualização dos resultados de conversão e do pitch deck.
- **`pdf_para_svg.py`:**
  Script Python de engenharia reversa construído exclusivamente com a biblioteca padrão (`sys`, `re`, `zlib`, `math`). Resolve o problema de PDFs impressos como curvas pelo Microsoft Print to PDF: decodifica o stream de desenho vetorial, interpreta comandos de traçado (`m`, `l`, `c`, `re`, `f`), aplica matrizes de transformação de coordenadas (CTM) e reconstrói cada página como um vetor SVG puro em alta resolução, gerando visualizadores HTML (`<nome>_p1.svg`, `<nome>_p1.html`, `index.html`).
- **`pdf_extrair_imagens.py`:**
  Utilitário de diagnóstico que inspeciona objetos de imagem (`/XObject /Subtype /Image`) embutidos em arquivos PDF, permitindo listar dimensões e formatos ou extrair streams codificados em JPEG (`/DCTDecode`) sem necessidade de dependências pesadas (como Poppler ou Pillow).
- **`ferramentas/README.md` (5.676 bytes):**
  Documentação técnica das ferramentas internas, explicando detalhadamente o desafio dos formulários vetoriais, como rodar os scripts, como inspecionar slides e a tabela de fontes consultadas para a montagem do pitch da banca estadual.

---

### 3.10. Front-end (`Desafio-LJ/front_end/`)

- **`index.html` (73.732 bytes):**
  Estrutura SPA (*Single Page Application*) principal do sistema. Contém:
  - Sidebar com navegação entre as seções: Dashboard, Pomodoro, Missões, Conquistas, Arcade de Jogos, Temas, Chat com IA.
  - Topbar com título dinâmico, avatar do herói, classe atual, barra de progresso de nível e botão de logout.
  - Seção Dashboard com cards de métricas (Nível, EXP, Streak), caixa de missão recomendada e timer compacto.
  - Seção Pomodoro com timer grande, visualizador de ciclo de foco, controles de modo (25/5, 50/10, etc.) e o monstro da sessão atual.
  - Seção de Missões com formulário de cadastro (título, matéria, data/prazo, prioridade), filtros e lista dinâmica.
  - Seção de Conquistas em grid exibindo 33 badges e status de bloqueado/desbloqueado.
  - Seção do Arcade de Jogos com botões de inicialização de cada um dos 18 minijogos e painel de lockout.
  - Seção de Temas com cards interativos de preview para alternância instantânea.
  - Seção de Chat com IA contendo interface de mensagens estilo mensageiro com avatar do robô e suporte a Markdown.
  - Modal de celebração de Level Up e modal de aviso de intervalo do Pomodoro.
- **`index.css` (62.074 bytes):**
  Folha de estilo global da aplicação. Implementa:
  - Tokens CSS com variáveis customizadas para 6 temas (`dark`, `ocean`, `forest`, `sunset`, `light`, `midnight`).
  - Animações refinadas para o anel de progresso do timer Pomodoro (`stroke-dashoffset`).
  - Estilização completa das interfaces individuais de cada um dos 18 minijogos (tabuleiros, peças, blocos, botões).
  - Responsividade total para desktops, tablets e dispositivos móveis com suporte a gaveta lateral (off-canvas).
- **`index.js` (135.666 bytes · 3.520 linhas):**
  O "cérebro" interativo do front-end. Agrupa:
  - Gestão de estado global em memória: usuário logado, status de jogo, configurações de tempo e timer ativo.
  - Navegação entre telas sem recarregamento de página (*hash routing / DOM swapping*).
  - Motor de áudio sintético via Web Audio API (gera bips em frequências harmônicas de 880 Hz para término de foco e 440 Hz para término de pausa sem necessidade de arquivos `.mp3` externos).
  - Funções de comunicação com a API REST (`apiFetch`) com injeção automática de credenciais e interceptador de respostas `401` com redirecionamento para o login.
  - Implementação nativa completa em código JavaScript puro dos 18 minijogos do Arcade.
  - Lógica do sistema de Batalha RPG: seleção procedural de monstros baseada na duração da sessão e perda de vida do monstro proporcional ao tempo de estudo decorrido.
  - Temporizador do *Game Lockout* (cooldown anti-abuso) que desativa e bloqueia os jogos se o aluno ultrapassar o tempo estipulado da pausa.
- **`landing.html` (12.250 bytes), `landing.css` (16.883 bytes), `landing.js` (1.516 bytes):**
  Página de captura e apresentação pública do produto. Destaca o conceito gamificado, apresenta o ciclo dos estudos, demonstra visualmente as funcionalidades com animações e direciona para as páginas de cadastro e login.
- **`login.html` (1.682 bytes), `login.css` (3.770 bytes), `login.js` (1.783 bytes):**
  Tela de login do usuário. Oferece validação em tempo real de e-mail e senha, spinner de carregamento assíncrono no botão, feedback de erros amigável em caixa de alerta e redirecionamento para o dashboard após autenticação bem-sucedida.
- **`register.html` (4.885 bytes), `register.css` (4.859 bytes), `register.js` (3.979 bytes):**
  Tela de cadastro de novos estudantes. Inclui:
  - Medidor visual de força de senha em tempo real com 5 níveis de entropia.
  - Validador de confirmação de senha idêntica.
  - Seletor de interesses em formato de chips selecionáveis (Anime, Futebol, Games, Música, Ciência, Tecnologia, etc.), que são enviados para o banco de dados e determinam a personalidade do mentor de IA.
- **`emoji-3d.js` (11.120 bytes):**
  Script modular de substituição de emojis Unicode por imagens 3D Fluent de alta definição. Utiliza `Intl.Segmenter` para quebra correta de grafemas, cria elementos semânticos acessíveis (`aria-label`, preservação do texto original oculto para leitores de tela), gerencia fila de downloads assíncronos (`AbortSignal.timeout`, limite de 2 downloads concorrentes) e observa visibilidade via `IntersectionObserver`.
- **`emoji-3d.css` (2.055 bytes):**
  Estilos de renderização dos emojis 3D: posicionamento inline alinhado ao texto, controle de tamanho relativo via `em`, animações de carregamento suave (*fade-in*) e classes de fallback para falha ou estado pendente.
- **`emoji-catalog.js` (15.023 bytes):**
  Catálogo JavaScript gerado automaticamente contendo os metadados dos 139 emojis mapeados no projeto (código Unicode, nome do arquivo e nome descritivo).
- **`README.md` (9.803 bytes):**
  Documentação técnica do front-end: arquitetura estática, funcionamento das seções, catálogo de variáveis CSS dos 6 temas, funcionamento matemático do anel de progresso SVG e especificações do sistema de emojis 3D.

---

### 3.11. Assets e Emojis 3D (`Desafio-LJ/front_end/assets/`)

- **`assets/corrida.png` (618.561 bytes):**
  Spritesheet horizontal contendo 8 quadros da animação de corrida do personagem herói utilizado no jogo de plataforma.
- **`assets/pulo.png` (618.561 bytes):**
  Spritesheet horizontal contendo 6 quadros da animação do herói saltando no ar.
- **`assets/vitoria.png` (710.261 bytes):**
  Spritesheet horizontal contendo 6 quadros da animação de comemoração e vitória do herói ao alcançar a bandeira final.
- **`assets/LEIA-ME.txt` (941 bytes):**
  Instruções técnicas para os artistas e designers da equipe sobre dimensões das spritesheets, quantidade de quadros por faixa e como atualizar a constante `HERO_SPRITES` em `index.js`.
- **`assets/emoji/manifest.json` (14.930 bytes):**
  Manifesto JSON contendo as definições de todos os emojis homologados no projeto: chave Unicode normalizada, nome amigável, caminho do arquivo PNG correspondente e caminho de origem no repositório da Microsoft.
- **`assets/emoji/CREDITOS.md` (1.837 bytes):**
  Atribuição formal de créditos à equipe de design da Microsoft pelo projeto *Fluent UI Emoji*, indicando autores, repositório de origem e conformidade de redistribuição.
- **`assets/emoji/LICENSE` (1.141 bytes):**
  Cópia da licença de código aberto MIT sob a qual os assets de emojis Fluent são disponibilizados para uso livre e modificação.
- **`assets/emoji/*.png` (97 arquivos locais):**
  Imagens pré-renderizadas de alta definição (256x256 px) que cobrem os 139 glifos catalogados na interface inicial do projeto.

---

### 3.12. Testes do Front-end (`Desafio-LJ/front_end/tests/`)

- **`tests/emoji-3d.html` (5.060 bytes):**
  Ambiente de testes visuais e automatizados do front-end. Testa carregamento dos 139 PNGs, renderização dinâmica, comportamento com seletores de variação, preservação de texto nativo em cópia de texto e exibe galeria completa de emojis com seus códigos hexadecimais.
- **`tests/emoji-remoto.html` (1.369 bytes):**
  Ambiente de teste para simulação de recebimento de mensagens dinâmicas contendo emojis inéditos (vindos de respostas de IA), validando o fluxo de solicitação sob demanda ao endpoint `/api/emoji/<code>.png` sem necessidade de gastar créditos da API do Gemini.

---

### 3.13. Scripts do Projeto (`Desafio-LJ/scripts/`)

- **`baixar-emojis.mjs` (2.432 bytes):**
  Script utilitário em Node.js (ES Modules). Lê o `manifest.json`, verifica a integridade de cada arquivo PNG local conferindo a assinatura binária (`89 50 4E 47 0D 0A 1A 0A`) e suas dimensões (entre 128 e 512 px). Caso falte alguma arte ou o arquivo esteja corrompido, efetua o download concorrente (até 6 conexões simultâneas) diretamente da fonte oficial e regera o `emoji-catalog.js`.

---

### 3.14. Apresentação e Pitch Deck (`Desafio-LJ/slides/`)

- **`pitch-levelup-study.html` (463.146 bytes · 1.782 linhas):**
  Apresentação digital interativa e autossuficiente criada para a **Banca Estadual do Desafio Liga Jovem**.
  - **Design System Nativo:** Paleta escura violeta e ouro inspirada em RPG (`--void`, `--arcane`, `--ember`, `--vitae`, `--crimson`), fontes Bricolage Grotesque e Manrope, e layout em proporção 16:9 estrita (1280x720 px) com escalonamento responsivo automático para qualquer resolução de tela via CSS Transform.
  - **Controles Interativos:** Navegação por teclado (`←`, `→`, barra de espaço, `Home`, `End`), atalho `O` para índice de capítulos, atalho `F` para tela cheia e barra de EXP inferior que avança proporcionalmente conforme os slides são percorridos.
  - **Pronto para Impressão:** Folha de estilos `@media print` otimizada para exportação no Google Chrome (`Ctrl+P`, Paisagem, Sem Margens, Gráficos de Fundo ativados), gerando o PDF exato de 20 páginas exigido pelo regulamento do Sebrae até as 10:00 do dia da banca.
  - **Conteúdo Estruturado em 20 Slides:**
    1. *Capa:* Título, slogan, equipe LAWS e destaques do produto.
    2. *O Problema:* A dor da inconstância, distração e desorganização.
    3. *Público-Alvo:* Estudantes de 11 a 24 anos (Fundamental II a Superior).
    4. *Validação:* Observação da rotina, pesquisa de referências e questionário ativo.
    5. *A Solução:* O ciclo fechado foco → organização → recompensa.
    6. *Como Funciona:* Os 5 passos da rotina de estudos gamificada.
    7. *Inovação:* A vantagem injusta da pausa com autolimite e a IA com linguagem jovem.
    8. *Comparativo:* Tabela comparativa contra Agenda de Papel, Trello/Todoist e Timers.
    9. *Protótipo - Dashboard:* Apresentação das telas centrais em execução.
    10. *Protótipo - Telas:* Missões, 33 Conquistas, Arcade com 18 jogos e Mentor IA.
    11. *Personalização e Autolimite:* A integração dos interesses e o bloqueio de 1:1.
    12. *Tecnologia:* Arquitetura leve (Vanilla JS, Flask, SQLite, Gemini 2.5 Flash).
    13. *Impacto e ODS:* Conexão sólida com os ODS 4, 3 e 10 da ONU.
    14. *Modelo de Negócio:* Lean Canvas completo em 9 blocos.
    15. *Viabilidade Financeira:* Fases Gratuita, Freemium e B2B escolar.
    16. *Métricas-Chave:* Retenção (Streak), Profundidade (Foco) e Engajamento (Missões).
    17. *Roadmap:* Hoje (v1.0), 3 meses (Piloto/PWA) e 6 a 12 meses (B2B/Escala).
    18. *Equipe:* Apresentação dos 4 integrantes da Equipe LAWS e seus papéis.
    19. *Encerramento:* Call to Action, solicitação de escolas parceiras e contatos.
    20. *Backup (FAQ):* Respostas estratégicas prontas para as perguntas difíceis dos jurados.

---

## 4. Arquitetura de Software e Fluxo de Dados

A arquitetura do LevelUp Study segue o princípio de **Stack Leve e Desacoplada**, permitindo que o sistema seja executado tanto em computadores escolares modestos quanto em servidores de nuvem de custo reduzido.

```
┌────────────────────────────────────────────────────────┐
│                   NAVEGADOR DO USUÁRIO                 │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ landing.html │  │  login.html  │  │ register.html│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                           │                            │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │         index.html (SPA - Single Page App)       │  │
│  │                                                  │  │
│  │  [Dashboard] [Pomodoro Timer] [Missões / Tarefas]│  │
│  │  [33 Conquistas] [Arcade 18 Jogos] [Chat com IA] │  │
│  │  [6 Temas CSS] [Sub-sistema de Emojis 3D Fluent] │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Fetch API / JSON
                            │ (Cookie de Sessão Lax)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   BACK-END (FLASK REST API)            │
│                       backend.py                       │
│                                                        │
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────┐  │
│  │  Auth Router  │ │ Status/Streak │ │ Tasks Router │  │
│  │ (/api/auth/*) │ │ (/api/status) │ │ (/api/tasks) │  │
│  └───────────────┘ └───────────────┘ └──────────────┘  │
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────┐  │
│  │ Pomodoro Ctr  │ │ Game Rewards  │ │ Suggestion   │  │
│  │(+50 XP/Streak)│ │(Anti-abuso cap│ │ (/api/suggest│  │
│  └───────────────┘ └───────────────┘ └──────────────┘  │
│  ┌─────────────────────────────────┐ ┌──────────────┐  │
│  │   AI Engine: Google Gemini 2.5  │ │ Emoji Cache  │  │
│  │(/api/ai/routine & /api/ai/chat) │ │(emoji_cache) │  │
│  └─────────────────────────────────┘ └──────────────┘  │
└─────────────┬───────────────────────────────┬──────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌────────────────────────┐
│      BANCO DE DADOS      │    │     EXTERNAL APIS      │
│         SQLite           │    │                        │
│     levelupstudy.db      │    │  • Google Gemini API   │
│                          │    │    (gemini-2.5-flash)  │
│  • users (com interests) │    │  • Emoji.family CDN    │
│  • user_stats            │    │    (Download seguro)   │
│  • tasks                 │    │                        │
│  • alembic_version       │    │                        │
└──────────────────────────┘    └────────────────────────┘
```

### Segurança e Autenticação
- **Armazenamento de Senhas:** Senhas nunca são salvas em texto puro; utiliza-se o algoritmo criptográfico PBKDF2 com salt aleatório e derivação SHA-256 via Werkzeug (`generate_password_hash` e `check_password_hash`).
- **Gerenciamento de Sessão:** Sessões assinadas criptograficamente pela `SECRET_KEY` do Flask e transmitidas através de cookies com atributo `SameSite=Lax`.
- **Proteção de Rotas:** Decorador/função `require_auth()` em todos os endpoints sensíveis, garantindo que usuários não autenticados recebam HTTP 401.

---

## 5. Mecânicas de Gamificação e RPG

O LevelUp Study transforma tarefas acadêmicas em uma jornada de RPG concreta.

### Tabela de Recompensas de Experiência (EXP)
| Ação Realizada no Sistema | Ganho de EXP | Observações |
|---|---|---|
| **Conclusão de Sessão Pomodoro** | **+50 EXP** | Foco mantido até o final da sessão. |
| **Missão Concluída (Prioridade Chefe / Alta)** | **+40 EXP** | Tarefas complexas ou com prazos urgentes. |
| **Missão Concluída (Prioridade Elite / Média)** | **+30 EXP** | Tarefas de dificuldade e prazo moderados. |
| **Missão Concluída (Prioridade Normal / Baixa)** | **+20 EXP** | Leituras curtas e exercícios simples. |
| **Partida no Arcade de Minijogos** | **+5 a +50 EXP** | Limitado estritamente a **150 EXP diários** (anti-abuso). |

### Fórmula de Níveis e Progressão
A progressão de nível é calculada de forma linear e previsível para o estudante:
$$\text{Nível} = \max\left(1, \left\lfloor \frac{\text{EXP Total}}{200} \right\rfloor + 1\right)$$
$$\text{EXP Restante para Próximo Nível} = (\text{Nível} \times 200) - \text{EXP Total}$$
$$\text{Progresso Percentual} = \left(\frac{\text{EXP Total} \pmod{200}}{200}\right) \times 100$$

### Classes do Herói
Conforme o aluno sobe de nível, sua classe evolui automaticamente:
1. **Aprendiz:** Nível 1
2. **Iniciado(a):** Nível 2
3. **Aventureiro(a):** Nível 3
4. **Escudeiro(a):** Nível 4
5. **Cavaleiro(a):** Nível 5
6. **Mestre do Foco:** Nível 7
7. **Lenda dos Estudos:** Nível 10+

### Distribuição de Atributos
O herói possui três atributos que crescem dinamicamente conforme as ações executadas:
- **Força:** Aumenta a cada sessão Pomodoro concluída (resistência e foco contínuo).
- **Sabedoria:** Aumenta a cada missão/tarefa concluída (absorção de conteúdo).
- **Disciplina:** Aumenta conforme os dias consecutivos de estudo (*streaks*) são mantidos.

### Batalha contra os Monstros da Distração
Durante a execução do Pomodoro, o aluno não visualiza apenas números decrescentes, mas sim uma arena de batalha onde o tempo de foco inflige dano contínuo a um monstro temático:
- *Goblin da Distração*
- *Fantasma do Celular*
- *Golem da Preguiça*
- *Slime da Procrastinação*
- *Vampiro da Madrugada*
- *Lobisomem do Feed*
- *Dragão da Notificação*
- *Titã do Desespero*

---

## 6. Arcade da Pausa (18 Minijogos e Sistema Anti-Vício)

O Arcade nativo do LevelUp Study foi projetado para acolher o estudante durante o intervalo do Pomodoro, evitando que ele abra redes sociais e perca a concentração.

### Os 18 Minijogos Nativos
1. **Snake (Cobrinha):** Jogo clássico com controle direcional e aumento de velocidade.
2. **2048:** Quebra-cabeça lógico de fusão de números em grade 4x4.
3. **Jogo da Memória:** Combinação de pares com cartas temáticas e contador de jogadas.
4. **Campo Minado:** Raciocínio lógico e probabilístico clássico.
5. **Jogo da Velha (Tic-Tac-Toe):** Partidas rápidas contra inteligência artificial simples.
6. **Quebra-Cabeça Deslizante:** Reordenação numérica de blocos 3x3.
7. **Wordle / Termo:** Desafio de adivinhação de palavras de 5 letras em 6 tentativas.
8. **Quiz das Matérias:** Perguntas e respostas categorizadas por disciplinas escolares:
   - *Matemática:* Aritmética, frações e geometria básica.
   - *Português:* Ortografia, gramática e concordância.
   - *História:* Fatos e períodos históricos do Brasil e do mundo.
   - *Geografia:* Climas, relevos, capitais e continentes.
   - *Ciências:* Biologia, química e física fundamentais.
9. **Forca:** Jogo clássico de adivinhação de vocabulário acadêmico.
10. **Desafio Relâmpago:** Teste de reflexos e cálculo mental contra o relógio.
11. **Associação:** Ligação entre pares de conceitos e suas respectivas definições.
12. **Anagrama:** Recomposição de letras embaralhadas para formação de palavras.
13. **Verdadeiro ou Falso:** Rodadas rápidas sobre curiosidades científicas e culturais.
14. **Simon (Genius):** Memorização de sequências luminosas e sonoras em expansão.
15. **Tetris:** Encaixe estratégico de peças geométricas (*tetraminós*).
16. **Lig 4 (Connect Four):** Estratégia de conexão de 4 fichas em linha.
17. **Breakout (Arkanoid):** Destruição de blocos utilizando rebote de bola e raquete.
18. **Plataforma (Estilo Mario):** Jogo de ação com física 2D completa, gravidade, plataformas suspensas, coleta de moedas e bandeira de vitória, utilizando os spritesheets de animação `corrida.png`, `pulo.png` e `vitoria.png`.

### A Mecânica de Autolimite (Game Lockout / Cooldown Proporcional)
Para garantir que o jogo não se torne uma nova fonte de procrastinação:
1. **Tolerância Inicial:** O aluno tem até 20 segundos após o término oficial da pausa para fechar o jogo.
2. **Penalização Proporcional (1 para 1):** Todo segundo excedido além da pausa é contabilizado. Se a pausa era de 5 minutos e o aluno jogou por 8 minutos, os 3 minutos de excesso se transformam em um **bloqueio absoluto de 3 minutos no Arcade**.
3. **Desbloqueio Automático:** A tela de bloqueio exibe uma contagem regressiva em tempo real com a mensagem: *“Jogos Bloqueados! O cooldown é igual ao tempo extra usado. Aproveite o tempo para iniciar um Pomodoro!”*.

---

## 7. Inteligência Artificial Contextualizada (Google Gemini)

O LevelUp Study não utiliza a Inteligência Artificial de maneira genérica. A API do **Google Gemini 2.5 Flash** é alimentada com o perfil comportamental de cada estudante.

### Os Dois Endpoints de IA
1. **Planejador de Rotina Diária (`GET /api/ai/routine`):**
   - Coleta o nome do usuário, nível, streak, interesses e a lista completa de tarefas pendentes com prioridades e prazos.
   - Gera um roteiro de estudos de 3 parágrafos curtos, indicando a sequência exata de tarefas para o dia e motivando o aluno a usar o timer.
2. **Mentor de Estudos Personalizado (`POST /api/ai/chat`):**
   - Funciona como um tutor que responde dúvidas sobre matérias escolares.
   - **Diferencial de Prompt:** O modelo recebe uma instrução estrita de ancoragem temática nos interesses do estudante:
     > *"IMPORTANTE: Use esses interesses como foco temático para analogias, exemplos práticos e explicações (ex: se ele gosta de futebol e estuda física, use chutes de jogadores para explicar; se gosta de anime, use poderes de personagens)."*

---

## 8. Sub-sistema de Emojis 3D e Cache Otimizado

A interface visual do LevelUp Study se destaca pelo acabamento estético moderno, propiciado pela biblioteca de emojis 3D estilo **Microsoft Fluent UI**.

### Como Funciona o Sub-sistema
- **Catálogo Base Local:** 139 ícones pré-baixados em `front_end/assets/emoji/` cobrem 100% dos textos estáticos da aplicação (login, cadastro, dashboard, minijogos e slides).
- **Carregamento Assíncrono Sob Demanda:** Caso a Inteligência Artificial gere uma resposta contendo um emoji que não esteja no catálogo inicial, o script `emoji-3d.js` intercepta o caractere e requisita a imagem ao endpoint local `/api/emoji/<code>.png`.
- **Segurança e Privacidade do Cache:**
  - O navegador nunca faz requisições diretas a servidores externos; comunica-se apenas com a API local.
  - O back-end em `emoji_cache.py` valida o código Unicode, baixa o PNG da CDN `www.emoji.family`, sanitiza o arquivo com a biblioteca Pillow (descartando qualquer exploit ou metadado) e armazena o resultado em `back_end/emoji-cache/` com controle via SQLite.

---

## 9. Modelo de Negócio e Estratégia de Apresentação (Pitch)

O modelo de negócio foi consolidado no **Lean Canvas** da equipe:

| Bloco do Canvas | Conteúdo Estratégico |
|---|---|
| **Problema** | Distrações digitais, procrastinação por sobrecarga, falta de sensação de evolução e fragmentação de aplicativos de estudo. |
| **Segmentos de Clientes** | Estudantes do Ensino Fundamental II ao Superior (11 a 24 anos); alunos de escolas públicas e privadas em áreas urbanas e rurais. |
| **Proposta de Valor Única** | *"O Duolingo da organização e do foco nos estudos"*: plataforma completa que transforma o estudo em uma jornada de RPG motivadora com ciclo fechado. |
| **Solução** | Pomodoro com batalha de monstros, gestão inteligente de missões, gamificação com EXP/níveis/streaks e arcade com autolimite. |
| **Canais** | Redes sociais com forte apelo jovem (TikTok, Instagram, Reels), palestras e cartazes em escolas parceiras e indicação entre colegas. |
| **Fontes de Receita** | **1. Freemium:** Versão básica 100% gratuita; planos premium com cosméticos de RPG e relatórios avançados.<br>**2. B2B Escolar:** Licenciamento e patrocínio de painéis de acompanhamento pedagógico para prefeituras e escolas privadas.<br>**3. Fomento:** Editais públicos e prêmios de inovação educacional. |
| **Estrutura de Custos** | Hospedagem em nuvem de baixo custo, banco de dados gerenciado, chamadas à API do Gemini e design de artes. |
| **Métricas-Chave** | Streak médio (retenção e criação de hábito), minutos de foco acumulados (profundidade) e missões concluídas por semana (engajamento). |
| **Vantagem Injusta** | O ciclo fechado autossuficiente e o Arcade nativo com bloqueio de excesso que impede a fuga do aluno para redes sociais. |

---

## 10. Plano de Deploy e Infraestrutura em Nuvem

O projeto possui documentação pronta e testada em `DEPLOY-ORACLE-HESTIA.md` para implantação em produção:

- **Provedor:** Oracle Cloud Infrastructure (OCI) — Camada *Always Free* (instância Compute rodando Ubuntu Linux).
- **Painel de Controle:** HestiaCP (gerenciador leve de web, DNS e certificados).
- **Servidor Web / Proxy Reverso:** Nginx configurado com os templates dedicados `levelup-study.tpl` e `levelup-study.stpl`, operando com terminação SSL automática via Let's Encrypt na porta 443 e redirecionando tráfego interno para `127.0.0.1:8017`.
- **Servidor de Aplicação WSGI:** Gunicorn rodando com 2 workers e 2 threads por worker sob o gerenciamento de processo do systemd (`levelup-study.service`).
- **Banco de Dados em Produção:** SQLite com volume persistente em disco ou migração direta para PostgreSQL via SQLAlchemy se houver demanda de escala massiva.

---

## 11. Síntese e Considerações Finais

A análise integral de todos os arquivos do repositório revela que o **LevelUp Study** não é apenas uma ideia conceitual, mas um **Mínimo Produto Viável de Alta Fidelidade (MVP Funcional)** totalmente concluído e operacional:

1. **Rigor Técnico:** O código-fonte é limpo, bem documentado e estruturado. A separação entre regras de negócio no backend Flask e a interface no frontend Vanilla JS assegura leveza e portabilidade para qualquer escola pública ou privada.
2. **Consistência de Produto:** Todos os artefatos se alinham com perfeição: o banco relacional suporta exatamente o que a interface exibe, os minijogos operam dentro das regras de anti-abuso, e o mentor de IA utiliza o perfil cadastrado pelo usuário.
3. **Alinhamento com o Desafio Liga Jovem:** A documentação dos slides, o Lean Canvas, a integração aos ODS 4, 3 e 10 e o atendimento estrito aos 5 critérios de avaliação da banca estadual colocam o projeto em posição de grande destaque competitivo.

O projeto está pronto para a etapa de bancas estaduais, validação em turmas piloto e publicação em ambiente de produção.
