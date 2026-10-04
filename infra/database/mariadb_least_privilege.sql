-- ==============================================================================
-- MariaDB Security Hardening: Least Privilege (Princípio do Menor Privilégio)
-- Sistema: LevelUp Study (Produção)
-- ==============================================================================

-- 1. Criação do Banco de Dados dedicado com charset UTF8MB4
CREATE DATABASE IF NOT EXISTS `LevelUp_db`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 2. Remoção de contas anônimas e bancos de teste de instalações padrão (se existirem)
DELETE FROM mysql.user WHERE User = '';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db = 'test' OR Db = 'test\\_%';

-- 3. Criação do Usuário da Aplicação Flask com conexão estrita local (localhost / 127.0.0.1)
-- IMPORTANTE: Substitua 'SUA_SENHA_MUITO_FORTE_AQUI_128BITS' por uma senha gerada via:
-- openssl rand -base64 32
CREATE USER IF NOT EXISTS 'levelup_app'@'localhost'
    IDENTIFIED BY 'SUA_SENHA_MUITO_FORTE_AQUI_128BITS';

CREATE USER IF NOT EXISTS 'levelup_app'@'127.0.0.1'
    IDENTIFIED BY 'SUA_SENHA_MUITO_FORTE_AQUI_128BITS';

-- 4. Revogação de quaisquer privilégios globais ou de sistema
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'levelup_app'@'localhost';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'levelup_app'@'127.0.0.1';

-- 5. Concessão APENAS dos privilégios DML necessários para a operação diária do app:
-- SELECT, INSERT, UPDATE, DELETE (Sem permissão de DROP DATABASE, SHUTDOWN, SUPER, etc.)
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `LevelUp_db`.*
    TO 'levelup_app'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON `LevelUp_db`.*
    TO 'levelup_app'@'127.0.0.1';

-- 6. Usuário de Migração (opcional / CI-CD):
-- Se for rodar 'flask db upgrade' em pipeline separado, utilize este usuário com DDL:
-- CREATE USER 'levelup_migrator'@'localhost' IDENTIFIED BY 'OUTRA_SENHA_FORTE';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON `LevelUp_db`.* TO 'levelup_migrator'@'localhost';

-- 7. Recarrega as tabelas de privilégios para efeito imediato
FLUSH PRIVILEGES;

-- 8. Verificação final de privilégios concedidos
SHOW GRANTS FOR 'levelup_app'@'localhost';
