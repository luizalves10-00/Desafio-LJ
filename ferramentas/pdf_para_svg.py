#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdf_para_svg.py — converte páginas de PDF desenhadas em vetor para SVG.

POR QUE ESTA FERRAMENTA EXISTE
------------------------------
Os PDFs exportados da plataforma do Desafio Liga Jovem (pasta `docs/`) foram
gerados pelo "Microsoft: Print To PDF" a partir do navegador. O resultado é um
PDF sem nenhuma fonte embutida: cada letra é desenhada como um contorno vetorial
(comandos `m`, `l`, `c`, `f`). Consequência prática:

  - `pdftotext` devolve vazio  -> não há camada de texto;
  - extrair as imagens internas devolve só o padrão de fundo -> o texto não é imagem.

Este script lê os *content streams* do PDF, aplica a matriz de transformação
corrente (CTM) em cada ponto e reemite tudo como `<path>` de SVG. O SVG
resultante abre em qualquer navegador, com o texto legível e em resolução
infinita — que foi como o conteúdo dos formulários acabou sendo lido.

Depende apenas da biblioteca padrão do Python (re, zlib). Sem poppler, sem PIL.

USO
---
    python pdf_para_svg.py arquivo.pdf
    python pdf_para_svg.py arquivo.pdf -o saida/ --largura 900
    python pdf_para_svg.py arquivo.pdf --faixas 620

Gera na pasta de saída:
    <nome>_p1.svg, <nome>_p2.svg, ...   uma página por arquivo
    <nome>_p1.html, ...                 visualizador de cada página
    index.html                          índice com todas as páginas

Para ler o resultado, sirva a pasta e abra no navegador:
    python -m http.server 5599 --directory saida
"""

import argparse
import html
import os
import re
import sys
import zlib

# ── operadores de cor e caminho que precisamos interpretar ────────────────────
# (o resto do PDF é ignorado de propósito: só queremos os contornos preenchidos)

TOKEN_RE = re.compile(
    rb"<<|>>|\[|\]|/[^\s/\[\]<>()]+|\((?:\\.|[^\\)])*\)|[-+0-9.]+|[A-Za-z*'\"]+"
)
OBJ_RE = re.compile(rb"(\d+)\s+0\s+obj(.*?)endobj", re.S)
NUM_RE = re.compile(rb"^[-+0-9.]+$")


def carregar_objetos(dados):
    """Devolve {numero_do_objeto: corpo_bruto} para todos os objetos do PDF."""
    return {int(m.group(1)): m.group(2) for m in OBJ_RE.finditer(dados)}


def ler_stream(corpo):
    """Extrai e descomprime o stream de um objeto. None se não houver stream."""
    inicio = corpo.find(b"stream")
    if inicio == -1:
        return None
    cabecalho = corpo[:inicio]
    i = inicio + len(b"stream")
    while corpo[i:i + 1] in (b"\r", b"\n"):
        i += 1
    fim = corpo.rfind(b"endstream")
    bruto = corpo[i:fim]
    if b"FlateDecode" in cabecalho:
        try:
            bruto = zlib.decompress(bruto)
        except zlib.error:
            try:
                bruto = zlib.decompressobj().decompress(bruto)
            except zlib.error:
                return None
    return bruto


def multiplicar(m1, m2):
    """Produto de duas matrizes 3x2 do PDF (a b c d e f)."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2,
    )


def aplicar(m, x, y):
    a, b, c, d, e, f = m
    return a * x + c * y + e, b * x + d * y + f


def listar_paginas(objetos):
    """Devolve [(numero, corpo)] das páginas, na ordem em que aparecem."""
    paginas = []
    for numero, corpo in objetos.items():
        compacto = corpo.replace(b" ", b"")
        if b"/Type/Page" in compacto and b"/Type/Pages" not in compacto:
            paginas.append((numero, corpo))
    paginas.sort()
    return paginas


def caixa_da_pagina(corpo):
    """Lê o MediaBox da página. Cai para A4 se não encontrar."""
    m = re.search(rb"/MediaBox\s*\[([^\]]*)\]", corpo)
    if not m:
        return 595.32, 841.92
    partes = [float(v) for v in m.group(1).split()]
    if len(partes) == 4:
        return partes[2] - partes[0], partes[3] - partes[1]
    return 595.32, 841.92


def converter_pagina(objetos, corpo_pagina, precisao=1):
    """Converte uma página em uma string SVG."""
    largura, altura = caixa_da_pagina(corpo_pagina)

    conteudo = re.search(rb"/Contents\s*\[([^\]]*)\]", corpo_pagina)
    if conteudo:
        ids = [int(v) for v in re.findall(rb"(\d+)\s+0\s+R", conteudo.group(1))]
    else:
        um = re.search(rb"/Contents\s+(\d+)\s+0\s+R", corpo_pagina)
        ids = [int(um.group(1))] if um else []

    fluxo = b"\n".join(
        filter(None, (ler_stream(objetos[i]) for i in ids if i in objetos))
    )
    tokens = TOKEN_RE.findall(fluxo)

    fmt = "%." + str(precisao) + "f"
    saida = []
    pilha = []
    ctm = (1, 0, 0, 1, 0, 0)
    cor = (0.0, 0.0, 0.0)
    args = []
    trecho = []
    atual = None
    inicio_sub = None

    def P(x, y):
        """Ponto do espaço do PDF para o espaço do SVG (Y invertido)."""
        X, Y = aplicar(ctm, x, y)
        return X, altura - Y

    def seg(prefixo, *pontos):
        return prefixo + " ".join(fmt % v for p in pontos for v in p)

    for token in tokens:
        if NUM_RE.match(token):
            try:
                args.append(float(token))
            except ValueError:
                args.append(0.0)
            continue

        op = token

        if op == b"q":
            pilha.append((ctm, cor))
        elif op == b"Q":
            if pilha:
                ctm, cor = pilha.pop()
        elif op == b"cm" and len(args) >= 6:
            ctm = multiplicar(tuple(args[-6:]), ctm)

        # ── construção de caminho ──
        elif op == b"m" and len(args) >= 2:
            trecho.append(seg("M", P(args[-2], args[-1])))
            atual = (args[-2], args[-1])
            inicio_sub = atual
        elif op == b"l" and len(args) >= 2:
            trecho.append(seg("L", P(args[-2], args[-1])))
            atual = (args[-2], args[-1])
        elif op == b"c" and len(args) >= 6:
            trecho.append(seg("C", P(args[-6], args[-5]), P(args[-4], args[-3]),
                                   P(args[-2], args[-1])))
            atual = (args[-2], args[-1])
        elif op == b"v" and len(args) >= 4 and atual:
            trecho.append(seg("C", P(*atual), P(args[-4], args[-3]),
                                   P(args[-2], args[-1])))
            atual = (args[-2], args[-1])
        elif op == b"y" and len(args) >= 4:
            fim = P(args[-2], args[-1])
            trecho.append(seg("C", P(args[-4], args[-3]), fim, fim))
            atual = (args[-2], args[-1])
        elif op == b"h":
            trecho.append("Z")
            if inicio_sub:
                atual = inicio_sub
        elif op == b"re" and len(args) >= 4:
            x, y, w, h = args[-4:]
            cantos = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)]
            trecho.append(seg("M", cantos[0]) + seg(" L", cantos[1])
                          + seg(" L", cantos[2]) + seg(" L", cantos[3]) + " Z")

        # ── cor de preenchimento ──
        elif op in (b"rg", b"sc", b"scn") and len(args) >= 3:
            cor = tuple(args[-3:])
        elif op == b"g" and len(args) >= 1:
            cor = (args[-1],) * 3
        elif op == b"k" and len(args) >= 4:
            c, m_, y_, k = args[-4:]
            cor = ((1 - c) * (1 - k), (1 - m_) * (1 - k), (1 - y_) * (1 - k))

        # ── pintura ──
        elif op in (b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"):
            if trecho:
                regra = ' fill-rule="evenodd"' if op.endswith(b"*") else ""
                rgb = "#%02x%02x%02x" % tuple(
                    max(0, min(255, int(round(v * 255)))) for v in cor
                )
                saida.append('<path d="%s" fill="%s"%s/>'
                             % (" ".join(trecho), rgb, regra))
            trecho = []
        elif op in (b"n", b"S", b"s"):
            trecho = []
        # W / W* (recorte) são ignorados: só marcam o caminho, não pintam

        args = []

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.2f %.2f" '
        'width="%.2f" height="%.2f" style="background:#fff">%s</svg>'
        % (largura, altura, largura, altura, "".join(saida))
    ), largura, altura


ESTILO_BASE = """
html,body{margin:0;padding:0;background:#0f0f14;color:#e8e6f0;
  font:14px/1.5 system-ui,'Segoe UI',sans-serif}
header{padding:14px 20px;border-bottom:1px solid #2a2740;
  display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
header b{font-size:15px}
header a{color:#c4b5fd;text-decoration:none}
header a:hover{text-decoration:underline}
main{padding:20px;display:flex;flex-direction:column;gap:20px;align-items:center}
img{display:block;background:#fff;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
"""


def escrever_visualizadores(pasta, base, paginas_info, largura, faixas):
    """Gera um HTML por página (ou por faixa) e um índice."""
    gerados = []

    for numero, (arquivo_svg, w_pt, h_pt) in enumerate(paginas_info, start=1):
        escala = largura / w_pt
        altura_px = int(round(h_pt * escala))

        if faixas:
            total = max(1, -(-altura_px // faixas))  # divisão para cima
            for faixa in range(total):
                nome = "%s_p%d_f%d.html" % (base, numero, faixa)
                corpo = (
                    '<div style="width:%dpx;height:%dpx;overflow:hidden;'
                    'position:relative;background:#fff;border-radius:6px">'
                    '<img src="%s" style="position:absolute;top:%dpx;left:0;width:%dpx">'
                    "</div>"
                    % (largura, faixas, html.escape(arquivo_svg),
                       -faixa * faixas, largura)
                )
                _escrever_html(pasta, nome,
                               "%s — página %d, faixa %d/%d"
                               % (base, numero, faixa + 1, total), corpo)
                gerados.append((nome, "Página %d · faixa %d" % (numero, faixa + 1)))
        else:
            nome = "%s_p%d.html" % (base, numero)
            corpo = ('<img src="%s" style="width:%dpx">'
                     % (html.escape(arquivo_svg), largura))
            _escrever_html(pasta, nome, "%s — página %d" % (base, numero), corpo)
            gerados.append((nome, "Página %d" % numero))

    itens = "".join(
        '<li><a href="%s">%s</a></li>' % (html.escape(n), html.escape(r))
        for n, r in gerados
    )
    _escrever_html(
        pasta, "index.html", "%s — páginas" % base,
        '<ul style="line-height:2;list-style:none;padding:0">%s</ul>' % itens,
    )
    return gerados


def _escrever_html(pasta, nome, titulo, corpo):
    doc = (
        '<!doctype html><html lang="pt-br"><head><meta charset="utf-8">'
        '<title>%s</title><style>%s</style></head><body>'
        '<header><b>%s</b><a href="index.html">← índice</a></header>'
        "<main>%s</main></body></html>"
        % (html.escape(titulo), ESTILO_BASE, html.escape(titulo), corpo)
    )
    with open(os.path.join(pasta, nome), "w", encoding="utf-8") as f:
        f.write(doc)


def main():
    ap = argparse.ArgumentParser(
        description="Converte páginas de PDF vetorial (sem fonte embutida) para SVG legível."
    )
    ap.add_argument("pdf", help="caminho do arquivo PDF")
    ap.add_argument("-o", "--saida", default="saida",
                    help="pasta de saída (padrão: saida)")
    ap.add_argument("--largura", type=int, default=900,
                    help="largura de exibição em px nos visualizadores (padrão: 900)")
    ap.add_argument("--faixas", type=int, default=0,
                    help="altura em px de cada faixa; 0 = página inteira em um HTML")
    ap.add_argument("--precisao", type=int, default=1,
                    help="casas decimais nas coordenadas do SVG (padrão: 1)")
    args = ap.parse_args()

    if not os.path.isfile(args.pdf):
        sys.exit("Arquivo não encontrado: %s" % args.pdf)

    os.makedirs(args.saida, exist_ok=True)
    base = re.sub(r"[^\w.-]+", "_", os.path.splitext(os.path.basename(args.pdf))[0])[:40]

    with open(args.pdf, "rb") as f:
        dados = f.read()

    objetos = carregar_objetos(dados)
    paginas = listar_paginas(objetos)
    if not paginas:
        sys.exit("Nenhuma página encontrada — o PDF pode usar streams de objetos "
                 "comprimidos (/ObjStm), que este script não desempacota.")

    info = []
    for i, (_, corpo) in enumerate(paginas, start=1):
        svg, w, h = converter_pagina(objetos, corpo, args.precisao)
        nome_svg = "%s_p%d.svg" % (base, i)
        with open(os.path.join(args.saida, nome_svg), "w", encoding="utf-8") as f:
            f.write(svg)
        info.append((nome_svg, w, h))
        print("página %d -> %s  (%d KB)" % (i, nome_svg, len(svg) // 1024))

    escrever_visualizadores(args.saida, base, info, args.largura, args.faixas)
    print("\n%d página(s) em %s" % (len(info), os.path.abspath(args.saida)))
    print("Para ler:  python -m http.server 5599 --directory %s" % args.saida)
    print("Depois abra: http://localhost:5599/index.html")


if __name__ == "__main__":
    main()
