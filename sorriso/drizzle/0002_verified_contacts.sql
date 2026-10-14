ALTER TABLE `patients` ADD `verified_contacts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- The platform audit chain (org_id NULL) needs its own uniqueness guard: UNIQUE(org_id, seq)
-- treats NULLs as distinct, so concurrent platform writers could otherwise fork the chain.
CREATE UNIQUE INDEX IF NOT EXISTS `audit_platform_seq_idx` ON `audit_log` (`seq`) WHERE `org_id` IS NULL;
