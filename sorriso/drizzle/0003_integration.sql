ALTER TABLE `appointments` ADD `rebook_offer_starts_at` integer;--> statement-breakpoint
ALTER TABLE `appointments` ADD `rebook_call_starts_at` integer;--> statement-breakpoint
ALTER TABLE `consents` ADD `unlinked_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `provider_delete_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `provider_delete_failed_at` integer;--> statement-breakpoint
ALTER TABLE `patients` ADD `erasure_requested_at` integer;--> statement-breakpoint
ALTER TABLE `practitioners` ADD `ics_issued_by_user_id` text REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `privacy_requests` ADD `answer_contact` text;--> statement-breakpoint
ALTER TABLE `reminders` ADD `only_if_risk` text;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `closed_at` integer;--> statement-breakpoint
-- Data: health funds that were only in the demo seed (critique 51: the production list must not be empty).
INSERT OR IGNORE INTO `funds` (`id`, `slug`, `name`, `kind`) VALUES
  ('fund_fisde', 'fisde', 'FISDE', 'fund'),
  ('fund_casagit', 'casagit', 'Casagit Salute', 'fund'),
  ('fund_allianz', 'allianz', 'Allianz', 'insurer');
--> statement-breakpoint
-- Data: risk-gated reminders carried their rule's onlyIfRisk as an id suffix ("<id>.risk-high").
UPDATE `reminders` SET `only_if_risk` = 'high' WHERE `only_if_risk` IS NULL AND `id` LIKE '%.risk-high';
--> statement-breakpoint
UPDATE `reminders` SET `only_if_risk` = 'medium' WHERE `only_if_risk` IS NULL AND `id` LIKE '%.risk-medium';
--> statement-breakpoint
-- Data: closed waitlist entries get the closing time retention used to approximate (last offer, else creation).
UPDATE `waitlist` SET `closed_at` = coalesce(`last_offered_at`, `created_at`) WHERE `closed_at` IS NULL AND `status` != 'active';
--> statement-breakpoint
-- Data: deferred erasures were marked by an "erasure:" prefix on the restriction reason.
UPDATE `patients` SET `erasure_requested_at` = coalesce(`restricted_at`, unixepoch() * 1000)
  WHERE `erasure_requested_at` IS NULL AND `restriction_reason` LIKE 'erasure:%';
--> statement-breakpoint
-- Data: rebooking offers and call requests were recorded only as audit rows (appointment.update with
-- metadata.rebook and metadata.startsAt); those about the visit's current start time still count.
UPDATE `appointments` SET `rebook_offer_starts_at` = `starts_at`
  WHERE `rebook_offer_starts_at` IS NULL AND EXISTS (
    SELECT 1 FROM `audit_log` a
    WHERE a.`entity_type` = 'appointment' AND a.`entity_id` = `appointments`.`id` AND a.`org_id` = `appointments`.`org_id`
      AND a.`action` = 'appointment.update' AND json_extract(a.`metadata`, '$.rebook') = 'offer'
      AND json_extract(a.`metadata`, '$.startsAt') = `appointments`.`starts_at`);
--> statement-breakpoint
UPDATE `appointments` SET `rebook_call_starts_at` = `starts_at`
  WHERE `rebook_call_starts_at` IS NULL AND EXISTS (
    SELECT 1 FROM `audit_log` a
    WHERE a.`entity_type` = 'appointment' AND a.`entity_id` = `appointments`.`id` AND a.`org_id` = `appointments`.`org_id`
      AND a.`action` = 'appointment.update' AND json_extract(a.`metadata`, '$.rebook') = 'call_requested'
      AND json_extract(a.`metadata`, '$.startsAt') = `appointments`.`starts_at`);
--> statement-breakpoint
-- Data: who issued each live practitioner feed, from the newest ics.feed.rotate row of that practitioner
-- (only when it turned the feed on and was done by a user who still exists).
UPDATE `practitioners` SET `ics_issued_by_user_id` = (
    SELECT a.`actor_id` FROM `audit_log` a
    WHERE a.`org_id` = `practitioners`.`org_id` AND a.`action` = 'ics.feed.rotate'
      AND a.`entity_type` = 'practitioner' AND a.`entity_id` = `practitioners`.`id`
      AND a.`seq` = (
        SELECT max(b.`seq`) FROM `audit_log` b
        WHERE b.`org_id` = `practitioners`.`org_id` AND b.`action` = 'ics.feed.rotate'
          AND b.`entity_type` = 'practitioner' AND b.`entity_id` = `practitioners`.`id`)
      AND a.`actor_type` = 'user' AND coalesce(json_extract(a.`metadata`, '$.enabled'), 1) != 0
      AND a.`actor_id` IN (SELECT `id` FROM `users`))
  WHERE `ics_issued_by_user_id` IS NULL AND `ics_enabled` = 1 AND `ics_token_hash` IS NOT NULL;
