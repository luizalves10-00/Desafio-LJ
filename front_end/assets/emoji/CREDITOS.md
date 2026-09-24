# Microsoft Fluent Emoji — imagens 3D locais

Arte: Microsoft Corporation, projeto [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji).
A licença MIT original acompanha esta pasta em [LICENSE](LICENSE).

O catálogo `manifest.json` registra cada emoji pelo Unicode exato e pelo nome
Unicode oficial. Variantes com e sem o seletor de apresentação U+FE0F usam a mesma
imagem. Não há substituição por desenhos de significado parecido.

Os PNGs são obtidos pelo endpoint Fluent de 256 px da emoji.family. As bandeiras
e teclas numéricas indisponíveis nesse endpoint vêm do diretório **3D** da
Microsoft, na revisão e caminho fixados no manifesto. A proporção original é
preservada: por exemplo, a bomba tem 256 × 248 px e a tecla 5 tem 256 × 264 px.

Atualizar/verificar os arquivos, na raiz do projeto:

```sh
node scripts/baixar-emojis.mjs
```

O script verifica a assinatura PNG e as dimensões, preserva arquivos válidos e
gera `front_end/emoji-catalog.js`. Os PNGs, manifesto, catálogo e licença devem
acompanhar o código no controle de versão. Esses arquivos são exibidos localmente.
Emojis novos são buscados pelo backend em `https://www.emoji.family`, no mesmo
pack Fluent de 256 px, e guardados em `back_end/emoji-cache/`. Esse cache derivado
usa a mesma licença MIT acima; preserve os créditos também ao distribuí-lo.
Falhas de imagem mantêm o caractere Unicode como fallback.

A camada `emoji-3d.js` atende HTML e mensagens dinâmicas; o canvas usa
`Emoji3D.drawText`. O texto Unicode continua disponível para acessibilidade,
cópia e regras dos jogos. Emojis novos de mensagens livres usam o Unicode completo
para a busca, incluindo tom de pele e sequências compostas, sem associação a uma
imagem parecida. Enquanto carrega, ou se o pack não tem a arte, aparece o original.
