# Cache de emojis 3D sob demanda

O frontend mantém os 139 PNGs do catálogo inicial. Ao encontrar um emoji novo
em uma resposta da IA ou outro texto da interface, consulta o backend local em
`GET /api/emoji/<unicode-em-hexadecimal>.png`. Exemplo: `/api/emoji/1f44b.png`.
O backend baixa a imagem Fluent de 256 px apenas se ela ainda não estiver local.
Nenhum texto de conversa, nome, cookie ou credencial é enviado ao fornecedor;
somente o Unicode do emoji integra a URL externa.

## Instalação e armazenamento

Instale `pip install -r requirements.txt` e reinicie o Flask. As dependências
adicionadas são `emoji` para validar sequências Unicode e Pillow para validar,
decodificar e regravar PNGs. O frontend e a API devem ser servidos no mesmo host,
como na configuração Flask existente.

Os downloads ficam em `back_end/emoji-cache/`, fora do Git e da pasta estática.
A pasta contém PNGs e `cache.sqlite3`, que controla reservas, falhas e limites
entre processos. Preserve essa pasta em um volume persistente ao hospedar o app.
Os créditos e a licença estão em `front_end/assets/emoji/` e também se aplicam
às imagens baixadas durante o uso. O cache pode ser descartado com o servidor
parado; os arquivos necessários serão baixados novamente.

## Limites e comportamento

- Exige sessão autenticada para iniciar um download novo. Imagens já locais
  podem ser lidas sem autenticação.
- Aceita apenas um emoji reconhecido, sem URLs, caminhos livres ou texto.
  O nome do arquivo deriva do Unicode; tons de pele e composições são preservados.
- Usa HTTPS e host fixo `www.emoji.family`, com redirecionamentos desativados.
- Solicita somente Fluent PNG de 256 px. Limita o download a 1 MiB, verifica
  assinatura, formato, dimensões e decodificação; regrava a imagem sem metadados.
- Timeout de socket de 8 s e janela de leitura de 12 s. Um último bloco pode
  consumir o timeout restante; o frontend cancela a espera após 25 s.
- No máximo 2 downloads simultâneos e 30 novos downloads por minuto no servidor.
  Reservas SQLite evitam que processos baixem o mesmo emoji simultaneamente.
- Cache de imagens limitado a 200 MiB. Ao atingir o teto, preserva o cache e
  usa fallback para novos emojis; não apaga arquivos automaticamente.
- Ausência de arte (404) fica registrada por 24 h. Falhas transitórias ficam
  registradas por 5 min e pausam novas consultas ao fornecedor por 1 min.
- Navegador usa carregamento próximo da área visível, duas requisições por vez
  e deduplicação por Unicode. Limita a 256 emojis remotos distintos por página.
  Novas renderizações podem tentar novamente após o prazo de falha indicado.
- Imagens salvas usam ETag e cache HTTP de 1 ano. Enquanto baixa ou em falhas,
  o emoji Unicode continua visível. A lógica dos jogos permanece textual.

## Testes

```sh
cd back_end
python -m unittest test_emoji_cache -v
```

No navegador, `/tests/emoji-3d.html` verifica a integração existente e
`/tests/emoji-remoto.html` simula mensagens com emojis novos sem consumir a IA.
É necessário estar autenticado no app para o segundo teste baixar imagens novas.

## Baixar todo o catálogo

A [API documenta uma listagem de emojis](https://www.emoji.family/developers)
em `/api/emojis`, com `includeVariations=true` para variações. A disponibilidade
de uma sequência nessa lista não garante uma imagem no pack Fluent: o endpoint
de imagem pode responder 404. A API também orienta consultar o fornecedor para
alto volume. Por isso o aplicativo usa cache sob demanda em vez de disparar
milhares de downloads durante a instalação ou uma resposta da IA.
