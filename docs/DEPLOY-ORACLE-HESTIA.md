# Deploy do LevelUp Study na Oracle Cloud com HestiaCP

Este procedimento publica o sistema em um domínio próprio sem interferir nos demais sites do servidor. O Hestia/Nginx recebe as conexões nas portas 80 e 443 e encaminha somente o domínio escolhido para o Gunicorn em `127.0.0.1:8017`.

## 1. Dados que devem ser definidos

Substitua estes exemplos em todos os comandos:

| Item | Exemplo usado |
|---|---|
| Usuário do Hestia | `levelup` |
| Domínio | `app.seudominio.com` |
| IP público da instância Oracle | `203.0.113.10` |
| Porta interna exclusiva | `8017` |
| Repositório | `https://github.com/luizalves10-00/Desafio-LJ.git` |
| Branch | `ui-e-ux-emojis-3d` |

Antes de usar `8017`, confirme que ela está livre:

```bash
sudo ss -ltnp | grep ':8017' || true
```

Se houver resultado, escolha outra porta acima de 1024 e altere a porta no arquivo do systemd e nos dois templates do Hestia.

## 2. O que será enviado ao servidor

O deploy via Git envia somente arquivos versionados da branch:

- `back_end/backend.py`, cache de emojis, migrações e dependências Python;
- `front_end/`, incluindo landing page, telas, CSS, JavaScript e imagens PNG 3D;
- `scripts/` usados pelo projeto;
- `deploy/`, com o serviço systemd e os templates do Hestia;
- arquivos de licença, manifesto e créditos dos emojis;
- documentação já versionada no repositório.

Não devem ser enviados:

- `.env`, chaves, senhas ou tokens;
- `.git/`, `.venv/`, `venv/`, `__pycache__/` e logs;
- `back_end/levelupstudy.db`, salvo quando houver uma migração deliberada dos dados atuais;
- `back_end/emoji-cache/`, pois o cache é recriado sob demanda;
- PDFs, arquivos de apoio e pastas locais que não estejam versionados;
- arquivos pessoais de IDE ou sistema operacional.

O banco SQLite será criado no servidor em `back_end/levelupstudy.db`. Se for necessário levar os usuários e dados atuais, faça uma cópia consistente do banco com o serviço local parado e envie o arquivo separadamente, antes de iniciar o serviço no servidor.

## 3. DNS e rede da Oracle Cloud

1. No provedor DNS, crie um registro `A` para `app.seudominio.com` apontando para o IP público da instância.
2. Na VCN da Oracle, abra regras de entrada TCP para as portas `80` e `443` na Security List ou no NSG ligado à instância.
3. Restrinja a porta `22` ao IP usado para administração sempre que possível.
4. Não abra a porta `8017`: o Gunicorn escuta somente em `127.0.0.1`.
5. Se o UFW estiver ativo, execute:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Confirme o DNS antes de solicitar o certificado:

```bash
dig +short app.seudominio.com
```

O resultado deve ser o IP público da instância.

## 4. Criar o domínio no HestiaCP

1. Entre no HestiaCP.
2. Abra **Web** e clique em **Add Web Domain**.
3. Informe `app.seudominio.com`.
4. Mantenha o proxy do Nginx habilitado.
5. Desative DNS e Mail para esse domínio quando esses serviços forem administrados fora do Hestia.
6. Salve sem ativar o certificado ainda.

O domínio terá sua própria configuração. Os outros sites do servidor continuam usando os respectivos domínios e templates.

## 5. Enviar o código com Git

Na máquina de desenvolvimento, publique a branch:

```bash
git switch ui-e-ux-emojis-3d
git push -u origin ui-e-ux-emojis-3d
```

No servidor, conecte por SSH e execute como root ou com sudo:

```bash
sudo mkdir -p /home/levelup/apps/levelup-study/shared
sudo chown -R levelup:levelup /home/levelup/apps
sudo -u levelup git clone --branch ui-e-ux-emojis-3d --single-branch \
  https://github.com/luizalves10-00/Desafio-LJ.git \
  /home/levelup/apps/levelup-study/current
```

Para repositório privado, configure uma deploy key somente de leitura no GitHub e use a URL SSH. Não coloque token na URL nem no histórico do terminal.

## 6. Instalar a aplicação

Instale os pacotes de sistema:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git
```

Crie o ambiente virtual e instale as dependências:

```bash
sudo -u levelup python3 -m venv /home/levelup/apps/levelup-study/current/.venv
sudo -u levelup /home/levelup/apps/levelup-study/current/.venv/bin/pip install --upgrade pip
sudo -u levelup /home/levelup/apps/levelup-study/current/.venv/bin/pip install \
  -r /home/levelup/apps/levelup-study/current/back_end/requirements.txt
```

## 7. Criar as variáveis de ambiente

Gere uma chave de sessão:

```bash
openssl rand -hex 32
```

Crie o arquivo protegido:

```bash
sudo install -o levelup -g levelup -m 600 /dev/null \
  /home/levelup/apps/levelup-study/shared/.env
sudo nano /home/levelup/apps/levelup-study/shared/.env
```

Conteúdo:

```dotenv
SECRET_KEY=COLE_A_CHAVE_GERADA_AQUI
GEMINI_API_KEY=COLE_A_CHAVE_DA_API_AQUI
```

`GEMINI_API_KEY` é necessária para o chat com IA. Não versione esse arquivo.

## 8. Preparar banco e diretórios graváveis

```bash
sudo -u levelup mkdir -p /home/levelup/apps/levelup-study/current/back_end/emoji-cache
cd /home/levelup/apps/levelup-study/current/back_end
sudo -u levelup env \
  PATH=/home/levelup/apps/levelup-study/current/.venv/bin:$PATH \
  FLASK_APP=backend \
  /home/levelup/apps/levelup-study/current/.venv/bin/flask db upgrade
sudo chown -R levelup:levelup /home/levelup/apps/levelup-study/current
```

Se não existir banco anterior, as migrações criam `back_end/levelupstudy.db`.

## 9. Instalar e iniciar o serviço systemd

Copie o modelo e substitua o usuário caso ele não seja `levelup`:

```bash
sudo cp /home/levelup/apps/levelup-study/current/deploy/systemd/levelup-study.service.example \
  /etc/systemd/system/levelup-study.service
sudo sed -i 's/USUARIO_HESTIA/levelup/g' /etc/systemd/system/levelup-study.service
sudo systemctl daemon-reload
sudo systemctl enable --now levelup-study
sudo systemctl status levelup-study --no-pager
```

Teste o backend diretamente no servidor:

```bash
curl -I http://127.0.0.1:8017/
```

O retorno esperado é HTTP `200` ou `302`. Em caso de falha:

```bash
sudo journalctl -u levelup-study -n 100 --no-pager
```

## 10. Instalar o proxy do Hestia

Este projeto inclui os templates `deploy/hestia/levelup-study.tpl` e `levelup-study.stpl`. Na instalação padrão com Nginx como proxy do Apache, copie-os para a pasta de templates do Nginx:

```bash
sudo cp /home/levelup/apps/levelup-study/current/deploy/hestia/levelup-study.tpl \
  /usr/local/hestia/data/templates/web/nginx/levelup-study.tpl
sudo cp /home/levelup/apps/levelup-study/current/deploy/hestia/levelup-study.stpl \
  /usr/local/hestia/data/templates/web/nginx/levelup-study.stpl
sudo chmod 644 /usr/local/hestia/data/templates/web/nginx/levelup-study.*tpl
```

No HestiaCP:

1. Abra **Web**.
2. Edite `app.seudominio.com`.
3. Em **Proxy Template**, escolha `levelup-study`.
4. Salve.

Ou aplique pela CLI do Hestia:

```bash
sudo /usr/local/hestia/bin/v-change-web-domain-proxy-tpl \
  levelup app.seudominio.com levelup-study yes
sudo /usr/local/hestia/bin/v-rebuild-web-domain \
  levelup app.seudominio.com yes
sudo nginx -t
```

Se o servidor usa Nginx sem Apache, confirme o modo em **Server > Configure > Web Server**. Nesse modo, instale o par na pasta indicada para templates Nginx/PHP-FPM pelo Hestia e selecione-o como **Web Template**. Não edite os templates padrão nem os arquivos gerados dentro de `/home/USUARIO/conf/web/`, porque o Hestia os recria.

## 11. Ativar HTTPS

Depois que o DNS estiver resolvendo corretamente:

1. Edite o domínio em **Web**.
2. Marque **Enable SSL for this domain**.
3. Marque **Use Let's Encrypt to obtain SSL certificate**.
4. Marque **Enable automatic HTTPS redirection**.
5. Salve.

Valide:

```bash
curl -I https://app.seudominio.com/
```

Abra no navegador:

- `https://app.seudominio.com/` — landing page;
- `https://app.seudominio.com/login.html` — login;
- `https://app.seudominio.com/register.html` — cadastro.

Faça um cadastro de teste, login, criação de missão, uso do calendário e carregamento dos emojis 3D.

## 12. Atualizações futuras

Na máquina local:

```bash
git switch ui-e-ux-emojis-3d
git push
```

No servidor:

```bash
cd /home/levelup/apps/levelup-study/current
sudo -u levelup git pull --ff-only origin ui-e-ux-emojis-3d
sudo -u levelup .venv/bin/pip install -r back_end/requirements.txt
cd back_end
sudo -u levelup env PATH=/home/levelup/apps/levelup-study/current/.venv/bin:$PATH \
  FLASK_APP=backend ../.venv/bin/flask db upgrade
sudo systemctl restart levelup-study
sudo systemctl status levelup-study --no-pager
curl -I https://app.seudominio.com/
```

## 13. Backup e retorno de versão

Antes de atualizar:

```bash
sudo systemctl stop levelup-study
sudo -u levelup cp \
  /home/levelup/apps/levelup-study/current/back_end/levelupstudy.db \
  /home/levelup/apps/levelup-study/shared/levelupstudy-$(date +%F-%H%M%S).db
sudo systemctl start levelup-study
```

Para voltar o código para um commit conhecido:

```bash
cd /home/levelup/apps/levelup-study/current
sudo -u levelup git log --oneline -10
sudo -u levelup git checkout ID_DO_COMMIT
sudo systemctl restart levelup-study
```

Depois de estabilizar, retorne à branch antes do próximo `pull`:

```bash
sudo -u levelup git switch ui-e-ux-emojis-3d
```

## 14. Diagnóstico rápido

```bash
sudo systemctl status levelup-study --no-pager
sudo journalctl -u levelup-study -n 100 --no-pager
sudo ss -ltnp | grep ':8017'
curl -I http://127.0.0.1:8017/
sudo nginx -t
sudo tail -n 100 /var/log/nginx/domains/app.seudominio.com.error.log
sudo /usr/local/hestia/bin/v-list-web-domain levelup app.seudominio.com json
```

Interpretação objetiva:

- `502 Bad Gateway`: serviço parado, porta diferente ou Gunicorn falhou;
- certificado não emitido: DNS incorreto, portas 80/443 fechadas ou proxy ainda não aplicado;
- `Permission denied`: diretórios ou banco não pertencem ao usuário do Hestia;
- chat sem resposta: confira `GEMINI_API_KEY` e o log do serviço;
- emoji não baixado: confira acesso HTTPS de saída e permissão em `back_end/emoji-cache/`.
