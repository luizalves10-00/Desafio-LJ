#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pdf_extrair_imagens.py — extrai as imagens embutidas em um PDF, sem dependências.

POR QUE ESTA FERRAMENTA EXISTE
------------------------------
Primeiro passo na leitura dos PDFs da pasta `docs/`: descobrir se o conteúdo é
imagem ou vetor. Este script lista todos os XObjects de imagem do arquivo e grava
em disco os que estão em JPEG (`/DCTDecode`), que é o caso mais comum em PDFs
gerados a partir de captura de tela.

No caso dos formulários do Desafio Liga Jovem o resultado foi revelador: as
imagens extraídas continham apenas o padrão de fundo da plataforma, sem uma
única letra — prova de que o texto estava desenhado em vetor. Daí a existência
do `pdf_para_svg.py`, que é a ferramenta que efetivamente resolveu o problema.

Ainda assim vale manter este script: em PDFs que *são* digitalizações, ele é o
caminho mais curto, e o modo `--listar` dá um diagnóstico rápido de qualquer PDF.

Depende apenas da biblioteca padrão do Python.

USO
---
    python pdf_extrair_imagens.py arquivo.pdf --listar
    python pdf_extrair_imagens.py arquivo.pdf -o imagens/
    python pdf_extrair_imagens.py arquivo.pdf -o imagens/ --min-largura 400
"""

import argparse
import os
import re
import sys

OBJ_RE = re.compile(rb"(\d+)\s+0\s+obj(.*?)endobj", re.S)


def objetos_de_imagem(dados):
    """Percorre o PDF e devolve os metadados de cada XObject de imagem."""
    achados = []
    for m in OBJ_RE.finditer(dados):
        numero = int(m.group(1))
        corpo = m.group(2)
        if b"/Subtype/Image" not in corpo.replace(b" ", b""):
            continue

        inicio = corpo.find(b"stream")
        if inicio == -1:
            continue
        cabecalho = corpo[:inicio]

        def campo(padrao, conv=int, padrao_valor=None):
            achou = re.search(padrao, cabecalho)
            return conv(achou.group(1)) if achou else padrao_valor

        i = inicio + len(b"stream")
        while corpo[i:i + 1] in (b"\r", b"\n"):
            i += 1
        fim = corpo.rfind(b"endstream")

        achados.append({
            "obj": numero,
            "largura": campo(rb"/Width\s+(\d+)", int, 0),
            "altura": campo(rb"/Height\s+(\d+)", int, 0),
            "filtro": campo(rb"/Filter\s*/(\w+)", lambda v: v.decode(), None),
            "espaco": campo(rb"/ColorSpace\s*/?(\w+)", lambda v: v.decode(), None),
            "dados": corpo[i:fim],
        })
    return achados


def main():
    ap = argparse.ArgumentParser(
        description="Extrai (ou apenas lista) as imagens embutidas em um PDF."
    )
    ap.add_argument("pdf", help="caminho do arquivo PDF")
    ap.add_argument("-o", "--saida", default="imagens",
                    help="pasta de saída (padrão: imagens)")
    ap.add_argument("--listar", action="store_true",
                    help="apenas lista as imagens, sem gravar nada")
    ap.add_argument("--min-largura", type=int, default=0,
                    help="ignora imagens mais estreitas que este valor em px")
    args = ap.parse_args()

    if not os.path.isfile(args.pdf):
        sys.exit("Arquivo não encontrado: %s" % args.pdf)

    with open(args.pdf, "rb") as f:
        dados = f.read()

    imagens = objetos_de_imagem(dados)
    if not imagens:
        print("Nenhuma imagem embutida encontrada.")
        print("Se o PDF tem texto visível mas nada aqui, o conteúdo é vetorial: "
              "use pdf_para_svg.py.")
        return

    if args.listar:
        print("%-6s %-12s %-12s %-10s %s" % ("obj", "dimensões", "filtro", "cor", "bytes"))
        for img in sorted(imagens, key=lambda i: -len(i["dados"])):
            print("%-6d %-12s %-12s %-10s %d"
                  % (img["obj"], "%dx%d" % (img["largura"], img["altura"]),
                     img["filtro"] or "-", img["espaco"] or "-", len(img["dados"])))
        print("\n%d imagem(ns). Filtros diferentes de DCTDecode não são gravados."
              % len(imagens))
        return

    os.makedirs(args.saida, exist_ok=True)
    base = re.sub(r"[^\w.-]+", "_", os.path.splitext(os.path.basename(args.pdf))[0])[:40]

    gravadas = puladas = 0
    for img in imagens:
        if img["largura"] < args.min_largura:
            puladas += 1
            continue
        if not img["dados"].startswith(b"\xff\xd8"):  # não é JPEG
            puladas += 1
            continue
        nome = "%s_obj%03d_%dx%d.jpg" % (base, img["obj"], img["largura"], img["altura"])
        with open(os.path.join(args.saida, nome), "wb") as f:
            f.write(img["dados"])
        gravadas += 1
        print(nome)

    print("\n%d gravada(s), %d ignorada(s), em %s"
          % (gravadas, puladas, os.path.abspath(args.saida)))


if __name__ == "__main__":
    main()
