# Frontend — LevelUp Study

Interface web construída com **HTML5, CSS3 e JavaScript puro** (sem frameworks). Todas as páginas são arquivos estáticos que consomem a API REST do backend via `fetch`.

---

## Sumário

- [Páginas](#páginas)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Como servir](#como-servir)
- [Autenticação no frontend](#autenticação-no-frontend)
- [Dashboard — seções](#dashboard--seções)
- [Sistema de temas](#sistema-de-temas)
- [Timer Pomodoro](#timer-pomodoro)
- [Comunicação com a API](#comunicação-com-a-api)

---

## Páginas

| Arquivo | Rota | Descrição |
|---|---|---|
| `login.html` | `/login.html` | Tela de login |
| `register.html` | `/register.html` | Tela de cadastro |
| `index.html` | `/index.html` | Dashboard principal (protegido) |

---

## Estrutura de arquivos

```
front_end/
├── index.html      # Dashboard: sidebar + 5 seções de conteúdo
├── login.html      # Formulário de login
└── register.html   # Formulário de cadastro com medidor de força de senha
```

Todo o CSS e JavaScript está inline em cada arquivo — sem dependências externas, sem bundler.

---

## Como servir

Basta abrir os arquivos no navegador. Para evitar problemas de CORS com o backend, sirva a pasta com um servidor local:

```bash
# Python (mais simples)
python -m http.server 5500 --directory front_end

# Node.js (se disponível)
npx serve front_end -l 5500
```

Acesse em `http://localhost:5500/login.html`.

> O backend precisa estar rodando em `http://localhost:5000` para as chamadas funcionarem.

---

## Autenticação no frontend

### login.html

- Valida e-mail e senha antes de enviar
- Exibe spinner durante a requisição
- Mostra mensagem de erro inline (sem `alert()`)
- Redireciona para `index.html` após login bem-sucedido

### register.html

- Valida todos os campos antes de enviar
- **Medidor de força de senha** em tempo real com 5 níveis (cor + texto)
- Verifica se as senhas coincidem em tempo real
- Redireciona para `index.html` após cadastro

### index.html — guard de autenticação

Na inicialização, o dashboard chama `GET /api/auth/me`:

```
Usuário abre index.html
        │
        ▼
   GET /api/auth/me
   ┌─── 200 OK ───────────────────┐
   │  Preenche nome, avatar, XP   │
   │  Carrega status e tarefas    │
   └──────────────────────────────┘
   ┌─── 401 Unauthorized ─────────┐
   │  Redireciona para login.html │
   └──────────────────────────────┘
```

Todas as chamadas à API usam `credentials: "include"` para enviar o cookie de sessão.

---

## Dashboard — seções

O `index.html` é uma Single Page Application simples: uma sidebar fixa com botões que alternam a visibilidade das seções sem recarregar a página.

### <img src="assets/emoji/1f3e0.png" alt="🏠" width="24" height="24" /> Dashboard

Visão geral com:
- 3 cards de estatísticas (nível, XP total, streak)
- Caixa de sugestão inteligente com botão de atualizar
- Timer Pomodoro compacto com anel SVG

### <img src="assets/emoji/23f1.png" alt="⏱" width="24" height="24" /> Pomodoro

- Timer grande com anel de progresso SVG animado
- Modos de duração: 25/5, 50/10, 15/3, 45/15 minutos
- Indicador de pomodoros concluídos no ciclo atual (4 bolinhas)
- Beep sonoro ao trocar entre foco e pausa (Web Audio API)
- Cards de estatísticas: total de pomodoros, XP acumulado, minutos de foco

### <img src="assets/emoji/1f4cb.png" alt="📋" width="24" height="24" /> Tarefas

- Formulário com: título, matéria, prazo e prioridade
- Lista com ordenação automática (não concluídas → alta prioridade → prazo mais próximo)
- Botão de concluir (+30 XP) e botão de excluir
- Badge colorido de prioridade (<img src="assets/emoji/1f534.png" alt="🔴" width="24" height="24" /> Alta · <img src="assets/emoji/1f7e1.png" alt="🟡" width="24" height="24" /> Média · <img src="assets/emoji/1f7e2.png" alt="🟢" width="24" height="24" /> Baixa)

### <img src="assets/emoji/1f3c6.png" alt="🏆" width="24" height="24" /> Conquistas

Grid de 11 badges. Badges bloqueados ficam com opacidade reduzida; desbloqueados recebem borda dourada.

| Badge | Condição |
|---|---|
| <img src="assets/emoji/1f345.png" alt="🍅" width="24" height="24" /> Primeiro Pomodoro | 1 pomodoro concluído |
| <img src="assets/emoji/1f525.png" alt="🔥" width="24" height="24" /> Em Chamas | 5 pomodoros |
| <img src="assets/emoji/1f4aa.png" alt="💪" width="24" height="24" /> Dedicação | 20 pomodoros |
| <img src="assets/emoji/1f680.png" alt="🚀" width="24" height="24" /> Maratonista | 50 pomodoros |
| <img src="assets/emoji/26a1.png" alt="⚡" width="24" height="24" /> Streak 3 dias | 3 dias seguidos |
| <img src="assets/emoji/1f31f.png" alt="🌟" width="24" height="24" /> Semana Perfeita | 7 dias seguidos |
| <img src="assets/emoji/1f451.png" alt="👑" width="24" height="24" /> Mês de Ouro | 30 dias seguidos |
| <img src="assets/emoji/1f3c6.png" alt="🏆" width="24" height="24" /> Nível 5 | Alcançar nível 5 |
| <img src="assets/emoji/1f48e.png" alt="💎" width="24" height="24" /> Nível 10 | Alcançar nível 10 |
| <img src="assets/emoji/2728.png" alt="✨" width="24" height="24" /> 500 XP | Acumular 500 XP |
| <img src="assets/emoji/1f308.png" alt="🌈" width="24" height="24" /> 2000 XP | Acumular 2000 XP |

### <img src="assets/emoji/1f3a8.png" alt="🎨" width="24" height="24" /> Temas

Seletor visual com preview em miniatura de cada tema. A escolha é salva em `localStorage` e aplicada automaticamente na próxima visita.

---

## Sistema de temas

Os temas são implementados com **CSS Custom Properties** no seletor `[data-theme="nome"]` na tag `<html>`. Trocar o tema altera instantaneamente todas as cores da página.

| Atributo `data-theme` | Nome visual |
|---|---|
| `dark` | <img src="assets/emoji/1f319.png" alt="🌙" width="24" height="24" /> Dark (padrão) |
| `ocean` | <img src="assets/emoji/1f30a.png" alt="🌊" width="24" height="24" /> Ocean |
| `forest` | <img src="assets/emoji/1f33f.png" alt="🌿" width="24" height="24" /> Forest |
| `sunset` | <img src="assets/emoji/1f305.png" alt="🌅" width="24" height="24" /> Sunset |
| `light` | <img src="assets/emoji/2600.png" alt="☀️" width="24" height="24" /> Light |
| `midnight` | <img src="assets/emoji/1f49c.png" alt="💜" width="24" height="24" /> Midnight |

**Variáveis CSS usadas:**

| Variável | Uso |
|---|---|
| `--bg` | Fundo da página |
| `--surface` | Cards e sidebar |
| `--surface2` | Inputs e itens de lista |
| `--border` | Bordas e separadores |
| `--accent` | Cor de destaque principal |
| `--accent2` | Cor de destaque secundária (textos coloridos) |
| `--accent-glow` | Sombra colorida nos botões primários |
| `--gold` | Badges, XP e destaques |
| `--green` | Sucesso, pausa do timer |
| `--red` | Danger, botão de excluir |
| `--text` / `--text2` | Texto principal e secundário |
| `--muted` | Texto de apoio, labels |

---

## Timer Pomodoro

O timer é compartilhado entre a seção Dashboard (mini) e a seção Pomodoro (full). Ambos exibem o mesmo estado e respondem aos mesmos botões.

**Anel de progresso SVG:**

O anel usa `stroke-dashoffset` para animar o progresso:

```
offset = circunferência × (1 − segundosRestantes / totalSegundos)
```

| Versão | Raio | Circunferência |
|---|---|---|
| Mini (dashboard) | 64px | 402.1px |
| Full (pomodoro) | 96px | 603.2px |

**Beep sonoro** ao fim de cada fase usa a **Web Audio API** (sem arquivo de áudio externo):

```javascript
const ctx = new AudioContext();
const osc = ctx.createOscillator();
// frequência 880 Hz ao fim do foco, 440 Hz ao fim da pausa
```

---

## Comunicação com a API

Todas as chamadas passam pela função `apiFetch`, que injeta `credentials: "include"` automaticamente:

```javascript
function apiFetch(url, opts = {}) {
  return fetch(url, { credentials: "include", ...opts });
}
```

Qualquer resposta `401` dispara `redirectLogin()`, que redireciona para `login.html`.

**Constante de base:**

```javascript
const API = "http://localhost:5000/api";
```

Para apontar para outro servidor, basta alterar essa constante em `index.html`, `login.html` e `register.html`.

## Emojis 3D locais

O catálogo inclui os 139 emojis do inventário, associados pelo Unicode exato.
A renderização compartilhada em `emoji-3d.js` atende login, cadastro, painel,
mensagens, jogos e apresentação. As regras dos jogos continuam usando o texto
Unicode; a imagem altera somente a apresentação.

Execute `node scripts/baixar-emojis.mjs` na raiz para validar/baixar os PNGs
e regenerar o catálogo. Distribua `assets/emoji` junto com o frontend.
Consulte [créditos e licença](assets/emoji/CREDITOS.md).

Com o backend em execução, abra `/tests/emoji-3d.html` para executar a verificação
de carregamento dos 139 PNGs, conteúdo dinâmico, fallback, seletores e canvas.
A página também apresenta uma galeria com o nome Unicode de cada imagem.
O material BMC possui uma [versão HTML com os emojis 3D](../docs_desafio/bmc.html);
o arquivo de texto original foi preservado como referência.

Emojis novos de respostas da IA são carregados sob demanda pela API local,
sem enviar a conversa ao fornecedor. O Unicode permanece visível durante a
busca ou em falhas. Consulte [cache, limites e testes](../back_end/EMOJIS.md).
