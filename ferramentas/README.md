# Ferramentas

Scripts usados para ler a documentação do projeto e montar o pitch da banca estadual.
Tudo aqui roda só com a **biblioteca padrão do Python 3.10+** — sem `pip install`,
sem poppler, sem Pillow.

| Arquivo | Para que serve |
|---|---|
| [`pdf_para_svg.py`](pdf_para_svg.py) | Converte páginas de PDF **desenhadas em vetor** para SVG legível |
| [`pdf_extrair_imagens.py`](pdf_extrair_imagens.py) | Lista e extrai as imagens embutidas em um PDF |
| [`launch.json`](launch.json) | Configuração de servidor local para pré-visualizar os slides |

---

## O problema que essas ferramentas resolveram

Os PDFs em `docs/` — as respostas do projeto cadastrado na plataforma do Desafio
Liga Jovem — foram gerados pelo **"Microsoft: Print To PDF"** a partir do navegador.
Isso produz um PDF sem nenhuma fonte embutida: **cada letra vira um contorno
vetorial** (comandos `m`, `l`, `c`, `f` no content stream).

Na prática, os caminhos normais falham todos:

| Tentativa | Resultado |
|---|---|
| `pdftotext arquivo.pdf -` | vazio — não existe camada de texto |
| Extrair as imagens do PDF | só o padrão de fundo da plataforma, sem uma letra |
| Renderizar página a página | `pdftoppm` não disponível neste ambiente |

O `pdf_para_svg.py` foi escrito para contornar isso: ele interpreta o content
stream, aplica a matriz de transformação (CTM) em cada ponto e reemite os
contornos como `<path>` de SVG. O texto fica legível e em resolução infinita.

> Se um dia precisarem reler esses formulários — para conferir uma resposta antes
> da banca, por exemplo — é essa a ferramenta a usar.

---

## `pdf_para_svg.py`

```bash
python ferramentas/pdf_para_svg.py "docs/informações do projeto cadastrado na plataforma.pdf" -o saida
```

Gera na pasta de saída:

- `<nome>_p1.svg`, `<nome>_p2.svg`, … — uma página por arquivo
- `<nome>_p1.html`, … — visualizador de cada página
- `index.html` — índice com todas as páginas

Para ler o resultado (SVGs grandes não abrem bem por `file://`, então sirva por HTTP):

```bash
python -m http.server 5599 --directory saida
```

Depois abra `http://localhost:5599/index.html`.

**Opções**

| Opção | Padrão | Efeito |
|---|---|---|
| `-o`, `--saida` | `saida` | pasta de destino |
| `--largura` | `900` | largura de exibição em px nos visualizadores |
| `--faixas` | `0` | corta cada página em faixas dessa altura em px (útil quando a tela é pequena); `0` mantém a página inteira |
| `--precisao` | `1` | casas decimais das coordenadas — reduzir diminui o tamanho do SVG |

**Limitação conhecida:** não desempacota streams de objetos comprimidos
(`/ObjStm`). PDFs modernos com compressão de objetos precisariam de um passo a
mais. Os PDFs desta pasta não usam.

---

## `pdf_extrair_imagens.py`

Primeiro passo de diagnóstico em qualquer PDF: descobrir se o conteúdo é imagem
ou vetor.

```bash
# só diagnosticar
python ferramentas/pdf_extrair_imagens.py docs_desafio/abertura.pdf --listar

# gravar os JPEGs em disco
python ferramentas/pdf_extrair_imagens.py docs_desafio/abertura.pdf -o imagens
```

O modo `--listar` mostra objeto, dimensões, filtro e tamanho de cada imagem.
Se todas as imagens forem só fundo e o PDF tiver texto visível, o conteúdo é
vetorial — vá para o `pdf_para_svg.py`.

Grava apenas imagens em JPEG (`/DCTDecode`), que é o formato usado em capturas
de tela. Use `--min-largura` para ignorar ícones e miniaturas.

---

## `launch.json` — pré-visualizar os slides

Copie para `.claude/launch.json` na raiz do repositório para poder subir um
servidor local rapidamente:

```bash
mkdir -p .claude && cp ferramentas/launch.json .claude/launch.json
```

Ou, sem depender de nada disso, direto no terminal:

```bash
python -m http.server 5599 --directory .
```

E abra `http://localhost:5599/slides/pitch-levelup-study.html`.

---

## Sobre o pitch

O deck está em [`../slides/pitch-levelup-study.html`](../slides/pitch-levelup-study.html) —
arquivo único, sem dependências externas além das fontes do Google Fonts (com
fallback caso a internet caia na hora da apresentação).

**Atalhos:** `←` `→` ou `espaço` navegam · `Home`/`End` vão ao início/fim ·
`O` abre o índice · `F` alterna tela cheia · clique nas bordas laterais · swipe no celular.

**Exportar o PDF para a organização** (o regulamento exige envio em PDF até as
10h do dia da banca): abra o deck no Chrome, `Ctrl+P`, layout **paisagem**,
margens **nenhuma**, e marque **"Gráficos de fundo"**. Cada slide sai como uma
página em 16:9.

---

## Documentos consultados na montagem do pitch

Para referência, de onde veio cada bloco de conteúdo do deck:

| Fonte | O que forneceu |
|---|---|
| `docs/Canvas.jpeg` | Lean Canvas completo — problema, solução, proposta de valor, vantagem injusta, canais, métricas, custos e receitas |
| `docs/informações do projeto cadastrado na plataforma*.pdf` | Respostas oficiais: problema, público-alvo, validação, solução, concorrência, divulgação, planejamento financeiro, etapa de prototipação |
| `docs_desafio/banca_estadual.pdf` | Regras da banca (5 min + 5 min) e os **5 critérios de avaliação**, que definiram o roteiro |
| `docs_desafio/Pitch` | Checklist oficial do pitch (capa, problema, público, solução, diferencial, protótipo, viabilidade, impacto, equipe, encerramento) |
| `docs_desafio/ods.pdf` | Contexto dos ODS e sua importância na avaliação |
| `back_end/backend.py`, `front_end/index.js` | Números reais do produto: XP por ação, teto diário, 33 conquistas, 18 jogos, 7 classes, 8 monstros, 6 temas |
| histórico do `git` | Nomes e atuação da equipe |
