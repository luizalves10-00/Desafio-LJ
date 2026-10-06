import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sourceDir = process.cwd();
const destDir = path.resolve(sourceDir, '../levelup-study-prod');

console.log('================================================================');
console.log('🚀 LEVELUP STUDY - GERADOR DE REPOSITÓRIO DE PRODUÇÃO (DevSecOps)');
console.log('================================================================');
console.log(`📁 Origem (Dev)  : ${sourceDir}`);
console.log(`📁 Destino (Prod) : ${destDir}\n`);

// 1. Cria a pasta de destino limpa se não existir
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 2. Lista explícita do que copiar (Segurança por Inclusão)
const itemsToCopy = [
  'back_end',
  'front_end',
  'infra',
  'deploy',
  'README.md',
];

// 3. Filtro de Segurança Cirúrgico
const filterFunc = (src) => {
  const filename = path.basename(src);
  const relativePath = path.relative(sourceDir, src).replace(/\\/g, '/');

  // Bloqueio estrito de arquivos sensíveis com credenciais reais
  if (['.env', '.env.local', '.env.production', '.envexample', '.DS_Store', 'Thumbs.db'].includes(filename)) {
    return false;
  }

  // Bloqueio estrito de bancos de dados locais de desenvolvimento
  if (filename.endsWith('.db') || filename.endsWith('.sqlite') || filename.endsWith('.sqlite3') ||
      filename.endsWith('.db-journal') || filename.endsWith('.db-wal')) {
    return false;
  }

  // Bloqueio de caches, temporários, ambientes virtuais e IDEs
  if (['node_modules', '.git', '.vscode', '.idea', '__pycache__', 'venv', '.venv', '.pytest_cache'].includes(filename)) {
    return false;
  }

  // Bloqueio de extensões compiladas de Python
  if (filename.endsWith('.pyc') || filename.endsWith('.pyo') || filename.endsWith('.pyd')) {
    return false;
  }

  // Bloqueio de testes e scripts de rascunho de dev
  if (filename === 'test_emoji_cache.py' || filename === 'extract_notes.py') {
    return false;
  }
  if (relativePath.startsWith('front_end/tests')) {
    return false;
  }

  // Limpeza cirúrgica do cache de emojis:
  // Copia a estrutura da pasta, mas não transfere arquivos gerados localmente em dev
  if (relativePath.startsWith('back_end/emoji-cache/') && relativePath !== 'back_end/emoji-cache') {
    return false;
  }

  return true;
};

// 4. Executa a cópia seletiva dos itens do sistema
let successCount = 0;
for (const item of itemsToCopy) {
  const srcPath = path.join(sourceDir, item);
  const destPath = path.join(destDir, item);

  if (fs.existsSync(srcPath)) {
    try {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true, filter: filterFunc });
      } else {
        if (filterFunc(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
      console.log(`✅ Copiado com segurança: ${item}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Erro ao copiar ${item}:`, err.message);
    }
  } else {
    console.warn(`⚠️ Item não encontrado na raiz (ignorado): ${item}`);
  }
}

// 5. Garante diretórios essenciais vazios com arquivo .keep
const destEmojiCache = path.join(destDir, 'back_end/emoji-cache');
if (!fs.existsSync(destEmojiCache)) {
  fs.mkdirSync(destEmojiCache, { recursive: true });
}
fs.writeFileSync(path.join(destEmojiCache, '.keep'), '');
console.log(`🧹 Pasta 'back_end/emoji-cache' sanitizada e preparada com arquivo .keep`);

// 6. Injeção do .env.example Sanitizado de Produção (Raiz e back_end/)
const cleanEnvExample = `# ==============================================================================
# LevelUp Study — Variáveis de Ambiente de Produção (.env.example)
# ==============================================================================
# Instruções para Produção (HestiaCP / VPS Linux):
# 1. Copie este arquivo para .env no servidor: cp .env.example .env
# 2. Preencha todas as variáveis com suas credenciais seguras de produção.
# ==============================================================================

# ── Configurações da Aplicação ────────────────────────────────────────────────
FLASK_APP=backend.py
FLASK_ENV=production
ENVIRONMENT=production
SECRET_KEY=gerar_uma_chave_segura_de_64_caracteres_hex_aqui
PORT=5000

# ── URLs e Domínio ────────────────────────────────────────────────────────────
DOMAIN=levelupstudy.com.br
FRONTEND_URL=https://levelupstudy.com.br
ALLOWED_ORIGINS=https://levelupstudy.com.br

# ── Banco de Dados (MariaDB / MySQL em Produção) ──────────────────────────────
USE_SQLITE=false
DATABASE_URL=mysql+pymysql://levelup_app:SUA_SENHA_FORTE@127.0.0.1:3306/LevelUp_db?charset=utf8mb4

DB_USER=levelup_app
DB_PASS=SUA_SENHA_MUITO_FORTE_128BITS
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=LevelUp_db

# ── DevSecOps & Criptografia em Repouso (Fernet AES-128-CBC) ──────────────────
# Gere via: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=gerar_chave_fernet_32_bytes_base64_aqui

# ── Inteligência Artificial (Google Gemini) ──────────────────────────────────
GEMINI_API_KEY=sua_chave_gemini_api_aqui

# ── Stripe (Pagamentos & Assinaturas em Produção) ─────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_PRODUCT_ID=prod_...

# ── Google Cloud Platform (Google Calendar OAuth 2.0) ─────────────────────────
CLIENT_ID=seu_client_id.apps.googleusercontent.com
CLIENT_SECRET=seu_client_secret_aqui
`;

fs.writeFileSync(path.join(destDir, '.env.example'), cleanEnvExample, 'utf-8');
fs.writeFileSync(path.join(destDir, 'back_end/.env.example'), cleanEnvExample, 'utf-8');
console.log(`✅ '.env.example' sanitizado gerado com sucesso (sem credenciais sensíveis)`);

// 7. Injeta o .gitignore Blindado de Produção
const gitignoreContent = `# ==============================================================================
# LEVELUP STUDY - .gitignore DE PRODUÇÃO (DevSecOps)
# ==============================================================================

# Variáveis de Ambiente e Segredos (NUNCA SUBIR AO GIT)
.env
.env.production
.env.local
.env*.local
.envexample
!.env.example
!back_end/.env.example

# Bancos de Dados Locais e Temporários
*.db
*.sqlite
*.sqlite3
*.db-journal
*.db-wal
back_end/*.db
back_end/*.sqlite

# Python & Ambientes Virtuais
__pycache__/
*.py[cod]
*$py.class
*.so
.venv/
venv/
ENV/
env/
.pytest_cache/

# Cache dinâmico gerado em tempo de execução
back_end/emoji-cache/*
!back_end/emoji-cache/.keep

# Dependências e Logs
node_modules/
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/
`;

fs.writeFileSync(path.join(destDir, '.gitignore'), gitignoreContent, 'utf-8');
console.log(`🛡️ Arquivo '.gitignore' blindado de produção injetado.`);

// 8. Injeta README.md Profissional de Produção
const cleanReadme = `# 🚀 LevelUp Study – Ambiente de Produção

Sistema gamificado de estudos, simulados e foco para concurseiros.  
Stack: **Flask (Python 3.12+), MariaDB, Vanilla JS, Nginx (HestiaCP), Stripe e Google OAuth**.

---

## 🏗️ Estrutura do Repositório

\`\`\`
levelup-study-prod/
├── back_end/             # API Flask, DevSecOps, IA Gemini e integrações
│   ├── backend.py        # Servidor e rotas da API
│   ├── security.py       # Criptografia Fernet, CSRF e Rate Limiting
│   ├── concurseiro_bank.py # Banco de questões e simulados
│   ├── emoji_cache.py    # Gerenciador de cache de emojis 3D
│   ├── sync_stripe_plans.py # Sincronizador de planos no Stripe
│   ├── migrations/       # Migrações Alembic / Flask-Migrate
│   └── requirements.txt  # Dependências Python
├── front_end/            # Interface Web (HTML, CSS Dark RPG Glassmorphism, JS)
│   ├── index.html        # Painel do aluno / Batalhas de Foco / Missões
│   ├── admin.html        # Painel do Super Admin / Gestão de Planos & Métricas
│   ├── checkout.html     # Checkout seguro Stripe
│   ├── login.html / register.html # Autenticação
│   ├── css/              # Estilos e temas Dark RPG
│   └── js/               # Scripts assíncronos da plataforma
├── infra/                # Hardening de Infraestrutura
│   ├── nginx/            # Templates Nginx HestiaCP (.stpl e .tpl)
│   └── database/         # Script SQL de Menor Privilégio MariaDB
├── deploy/               # Scripts e serviços para servidor Linux
│   └── systemd/          # Serviço systemd para Gunicorn
├── .env.example          # Modelo de configuração de ambiente
└── .gitignore            # Blindagem de arquivos e segredos
\`\`\`

---

## ⚡ Guia Rápido de Instalação no Servidor (HestiaCP / Ubuntu)

### 1. Banco de Dados MariaDB
Execute o script de permissões mínimas no MariaDB:
\`\`\`bash
mysql -u root -p < infra/database/mariadb_least_privilege.sql
\`\`\`

### 2. Configurar o Backend
\`\`\`bash
cd back_end
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env # configure as senhas e chaves de produção
flask db upgrade
\`\`\`

### 3. Serviço Systemd (Gunicorn)
\`\`\`bash
sudo cp deploy/systemd/levelup-study.service.example /etc/systemd/system/levelup-study.service
sudo systemctl daemon-reload
sudo systemctl enable --now levelup-study
\`\`\`

### 4. Nginx (HestiaCP)
\`\`\`bash
sudo cp infra/nginx/levelup-study.* /usr/local/hestia/data/templates/web/nginx/php-fpm/
v-rebuild-web-domains <seu_usuario_hestia>
\`\`\`
`;

fs.writeFileSync(path.join(destDir, 'README.md'), cleanReadme, 'utf-8');
console.log(`📄 'README.md' de produção criado com instruções operacionais.`);

// 9. Inicializa o novo repositório Git limpo se não existir
const gitDir = path.join(destDir, '.git');
if (!fs.existsSync(gitDir)) {
  try {
    execSync('git init', { cwd: destDir, stdio: 'ignore' });
    execSync('git branch -M main', { cwd: destDir, stdio: 'ignore' });
    execSync('git add .', { cwd: destDir, stdio: 'ignore' });
    execSync('git commit -m "feat: initial clean production release"', { cwd: destDir, stdio: 'ignore' });
    console.log(`🎉 Novo repositório Git inicializado em '${destDir}' com commit inicial limpo!`);
  } catch (gitErr) {
    console.warn(`⚠️ Não foi possível inicializar o Git automaticamente: ${gitErr.message}`);
  }
} else {
  console.log(`ℹ️ Repositório Git já existente em '${destDir}'.`);
}

console.log('\n================================================================');
console.log('🎉 REPOSITÓRIO DE PRODUÇÃO GERADO COM SUCESSO!');
console.log('================================================================');
console.log(`📁 Localização da pasta limpa de produção:`);
console.log(`   ${destDir}\n`);
console.log(`Próximos passos para publicar no seu novo repositório GitHub:`);
console.log(`  1. cd "${destDir}"`);
console.log(`  2. git remote add origin https://github.com/SEU-USUARIO/SEU-NOVO-REPOSITORIO.git`);
console.log(`  3. git push -u origin main\n`);
