-- ==============================================================================
-- LevelUp Study - Migração de Colunas Google Calendar & Assinaturas (MariaDB / MySQL)
-- ==============================================================================

USE `LevelUp_db`;

-- Adiciona colunas de Google Calendar e OAuth se não existirem
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `google_access_token` TEXT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `google_refresh_token` TEXT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `google_token_expiry` DATETIME NULL;

-- Garante também colunas de interesses e controle de acesso
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `interests` VARCHAR(500) DEFAULT '';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `role` VARCHAR(20) DEFAULT 'student' NOT NULL;

-- Garante colunas de Stripe / Assinaturas
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `stripe_customer_id` VARCHAR(120) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `stripe_subscription_id` VARCHAR(120) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `stripe_plan_id` VARCHAR(100) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `subscription_status` VARCHAR(50) DEFAULT 'free';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `current_period_end` DATETIME NULL;
