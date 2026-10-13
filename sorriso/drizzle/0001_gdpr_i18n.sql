CREATE TABLE `audit_anchors` (
	`org_key` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`hash` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`seq` integer NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`reason` text,
	`ip_hash` text,
	`ua_hash` text,
	`metadata` text,
	`prev_hash` text,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_org_at_idx` ON `audit_log` (`org_id`,`at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_org_seq_idx` ON `audit_log` (`org_id`,`seq`);--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`email` text,
	`org_id` text,
	`role` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`patient_id` text,
	`appointment_id` text,
	`waitlist_id` text,
	`purpose` text NOT NULL,
	`granted` integer NOT NULL,
	`text_key` text NOT NULL,
	`text_version` text NOT NULL,
	`locale` text NOT NULL,
	`method` text NOT NULL,
	`source` text NOT NULL,
	`actor_relation` text DEFAULT 'self' NOT NULL,
	`actor_user_id` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `consents_patient_purpose_idx` ON `consents` (`patient_id`,`purpose`,`created_at`);--> statement-breakpoint
CREATE INDEX `consents_org_created_idx` ON `consents` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`template_id` text NOT NULL,
	`version` text NOT NULL,
	`locale` text NOT NULL,
	`answers` text NOT NULL,
	`red_flags` text DEFAULT '[]' NOT NULL,
	`signer_name` text,
	`signed_at` integer,
	`signed_via` text,
	`otp_challenge_id` text,
	`exported_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `form_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `form_submissions_patient_idx` ON `form_submissions` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `form_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`schema` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_templates_unique_idx` ON `form_templates` (`org_id`,`kind`,`version`);--> statement-breakpoint
CREATE TABLE `funds` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'fund' NOT NULL,
	`website` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funds_slug_unique` ON `funds` (`slug`);--> statement-breakpoint
CREATE TABLE `legal_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`user_id` text,
	`document_type` text NOT NULL,
	`version` text NOT NULL,
	`locale` text NOT NULL,
	`accepted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_hash` text,
	`ua_hash` text,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `legal_acceptances_org_doc_idx` ON `legal_acceptances` (`org_id`,`document_type`,`accepted_at`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`success` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `login_attempts_ip_idx` ON `login_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `notice_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`kind` text NOT NULL,
	`locale` text NOT NULL,
	`version` text NOT NULL,
	`content_hash` text NOT NULL,
	`published_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notice_versions_unique_idx` ON `notice_versions` (`org_id`,`kind`,`locale`,`content_hash`);--> statement-breakpoint
CREATE TABLE `org_funds` (
	`org_id` text NOT NULL,
	`fund_id` text NOT NULL,
	`mode` text NOT NULL,
	`service_ids` text,
	`note` text,
	PRIMARY KEY(`org_id`, `fund_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `patient_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_hash` text NOT NULL,
	`contact_type` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`patient_id` text,
	`type` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`details` text,
	`contact_hash` text,
	`requester_locale` text DEFAULT 'it' NOT NULL,
	`received_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`extended_until` integer,
	`extension_reason` text,
	`decision` text,
	`decision_reason` text,
	`closed_at` integer,
	`handled_by_user_id` text,
	`reminders_sent` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`handled_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_org_status_due_idx` ON `privacy_requests` (`org_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `profile_stats` (
	`practitioner_id` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`search_impressions` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`practitioner_id`, `day`),
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recalls` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`service_id` text NOT NULL,
	`practitioner_id` text,
	`source_appointment_id` text,
	`booked_appointment_id` text,
	`due_date` text NOT NULL,
	`interval_months` integer NOT NULL,
	`status` text DEFAULT 'due' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer,
	`lease_until` integer,
	`reason_code` text,
	`set_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`booked_appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`set_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recalls_org_status_due_idx` ON `recalls` (`org_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `recalls_patient_idx` ON `recalls` (`patient_id`);--> statement-breakpoint
CREATE TABLE `review_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`org_id` text NOT NULL,
	`reporter_user_id` text,
	`reporter_contact_hash` text,
	`ground` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`patient_asked_at` integer,
	`patient_response` text,
	`decision` text,
	`decision_reason` text,
	`decided_by_user_id` text,
	`decided_at` integer,
	`appeal_of_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_reports_status_idx` ON `review_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `review_reports_review_idx` ON `review_reports` (`review_id`);--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`channel` text NOT NULL,
	`target_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_codes_target_idx` ON `verification_codes` (`target_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `scopes` text DEFAULT '["appointments:read","appointments:write","patients:read"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `allowed_ips` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `created_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `appointments` ADD `manage_token_hash` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `manage_token_enc` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `processing_context` text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `booked_for` text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `booked_by_name` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `booked_by_phone` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `booked_by_email` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `notice_version` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `notice_locale` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `minor_flag` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `risk_level` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `risk_reasons` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `risk_computed_at` integer;--> statement-breakpoint
ALTER TABLE `appointments` ADD `fund_id` text REFERENCES funds(id);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_manage_token_hash_unique` ON `appointments` (`manage_token_hash`);--> statement-breakpoint
ALTER TABLE `locations` ADD `accessibility` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `instructions_version` text;--> statement-breakpoint
ALTER TABLE `memberships` ADD `instructions_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `memberships` ADD `invited_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `memberships` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `redacted_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `provider_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `final_status_at` integer;--> statement-breakpoint
CREATE INDEX `messages_provider_id_idx` ON `messages` (`provider_id`);--> statement-breakpoint
CREATE INDEX `messages_to_created_idx` ON `messages` (`to`,`created_at`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `legal_name` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `vat_number` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `registered_address` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `privacy_email` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `dpo_name` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `dpo_email` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `medical_director` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `default_locale` text DEFAULT 'it' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `content_locale` text DEFAULT 'it' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `inbound_number` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `email_verified_at` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `closure_requested_at` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `purge_after` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_inbound_number_unique` ON `organizations` (`inbound_number`);--> statement-breakpoint
ALTER TABLE `patients` ADD `guardian_name` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `guardian_relation` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `guardian_phone` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `guardian_email` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `contact_verified_at` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `restricted_at` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `restriction_reason` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `retain_until` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `erased_at` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `possible_duplicate_of_id` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `merged_into_id` text;--> statement-breakpoint
CREATE INDEX `patients_org_guardian_phone_idx` ON `patients` (`org_id`,`guardian_phone`);--> statement-breakpoint
CREATE INDEX `patients_org_guardian_email_idx` ON `patients` (`org_id`,`guardian_email`);--> statement-breakpoint
ALTER TABLE `practitioners` ADD `ics_token_hash` text;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `ics_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `ics_token_expires_at` integer;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `spoken_languages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `public_profile` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `profile_approved_at` integer;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `profile_approved_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `practitioners` ADD `marketplace_opt_out_at` integer;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `albo_province` text;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `albo_number` text;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `albo_verified_at` integer;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `albo_verified_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `practitioners` ADD `specializations` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `care_options` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `bio_i18n` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `specialty_i18n` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `practitioners_ics_token_hash_unique` ON `practitioners` (`ics_token_hash`);--> statement-breakpoint
ALTER TABLE `reviews` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `author_display` text DEFAULT 'pseudonym' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `locale` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `flags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `consent_id` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `published_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `edited_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `removed_reason` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `reply_updated_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `reply_by_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `reviews_practitioner_status_idx` ON `reviews` (`practitioner_id`,`status`);--> statement-breakpoint
ALTER TABLE `services` ADD `price_type` text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `price_max_cents` integer;--> statement-breakpoint
ALTER TABLE `services` ADD `price_includes` text;--> statement-breakpoint
ALTER TABLE `services` ADD `recall_months` integer;--> statement-breakpoint
ALTER TABLE `services` ADD `sensitive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `name_i18n` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `description_i18n` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `mfa_verified_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip_hash` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locale` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret_enc` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `recovery_code_hashes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `password_changed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `is_platform_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `processing_context` text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `booked_for` text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `notice_version` text;--> statement-breakpoint
-- Data: Italian supplementary health funds and insurers (fondi sanitari integrativi).
-- Practices declare which ones they work with (direct or indirect reimbursement) in org_funds.
INSERT OR IGNORE INTO `funds` (`id`, `slug`, `name`, `kind`) VALUES
  ('fund_fasi', 'fasi', 'FASI', 'fund'),
  ('fund_fasdac', 'fasdac', 'FASDAC', 'fund'),
  ('fund_faschim', 'faschim', 'FASCHIM', 'fund'),
  ('fund_metasalute', 'metasalute', 'Fondo Metasalute', 'fund'),
  ('fund_fondoest', 'fondo-est', 'Fondo Est', 'fund'),
  ('fund_sanimpresa', 'sanimpresa', 'Sanimpresa', 'fund'),
  ('fund_quas', 'quas', 'Qu.A.S.', 'fund'),
  ('fund_sanilog', 'sanilog', 'Sanilog', 'fund'),
  ('fund_unisalute', 'unisalute', 'UniSalute', 'insurer'),
  ('fund_rbm', 'intesa-sanpaolo-rbm-salute', 'Intesa Sanpaolo RBM Salute', 'insurer'),
  ('fund_welion', 'generali-welion', 'Generali Welion', 'insurer'),
  ('fund_posteassicura', 'poste-assicura', 'Poste Assicura', 'insurer'),
  ('fund_previmedical', 'previmedical', 'Previmedical', 'insurer'),
  ('fund_blueassistance', 'blue-assistance', 'Blue Assistance', 'insurer'),
  ('fund_myassistance', 'myassistance', 'MyAssistance', 'insurer');
--> statement-breakpoint
-- Data: reviews gain a status. Existing reviews were collected without a separate publication
-- consent, so they are shown pseudonymously from now on.
UPDATE `reviews` SET `status` = CASE WHEN `published` = 1 THEN 'published' ELSE 'under_review' END,
  `author_display` = 'pseudonym', `published_at` = CASE WHEN `published` = 1 THEN `created_at` ELSE NULL END
  WHERE `status` = 'pending';
--> statement-breakpoint
-- Data: existing accounts and practices were already in use: treat their emails as verified
-- (avoids locking them out when verification becomes mandatory).
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;
--> statement-breakpoint
UPDATE `organizations` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;
--> statement-breakpoint
UPDATE `memberships` SET `created_at` = (unixepoch() * 1000) WHERE `created_at` IS NULL;
--> statement-breakpoint
UPDATE `sessions` SET `last_seen_at` = `created_at` WHERE `last_seen_at` IS NULL;
--> statement-breakpoint
-- Data: practitioners listed under the old terms stay listed, but their approval is pending
-- (profile_approved_at NULL): the dashboard asks them to confirm their public profile.
UPDATE `practitioners` SET `public_profile` = 1 WHERE `active` = 1 AND `profile_approved_at` IS NULL AND `public_profile` = 0;
