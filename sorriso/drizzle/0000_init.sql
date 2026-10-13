CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`location_id` text NOT NULL,
	`practitioner_id` text NOT NULL,
	`room_id` text,
	`service_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`blocked_until` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`confirmation` text DEFAULT 'pending' NOT NULL,
	`confirmed_at` integer,
	`confirmed_via` text,
	`source` text NOT NULL,
	`is_new_patient` integer DEFAULT false NOT NULL,
	`patient_note` text,
	`internal_note` text,
	`manage_token` text NOT NULL,
	`cancelled_at` integer,
	`cancelled_by` text,
	`cancel_reason` text,
	`rescheduled_from_id` text,
	`needs_attention` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_manage_token_unique` ON `appointments` (`manage_token`);--> statement-breakpoint
CREATE INDEX `appointments_org_start_idx` ON `appointments` (`org_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_practitioner_start_idx` ON `appointments` (`practitioner_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_location_start_idx` ON `appointments` (`location_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`postal_code` text,
	`phone` text,
	`lat` real,
	`lng` real,
	`timezone` text DEFAULT 'Europe/Rome' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_org_idx` ON `locations` (`org_id`);--> statement-breakpoint
CREATE INDEX `locations_city_idx` ON `locations` (`city`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` text NOT NULL,
	`org_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`user_id`, `org_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`appointment_id` text,
	`patient_id` text,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`to` text NOT NULL,
	`from` text,
	`subject` text,
	`body` text NOT NULL,
	`html` text,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text,
	`error` text,
	`intent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `messages_org_created_idx` ON `messages` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`phone` text,
	`email` text,
	`website` text,
	`brand_color` text DEFAULT '#0d9488' NOT NULL,
	`timezone` text DEFAULT 'Europe/Rome' NOT NULL,
	`settings` text NOT NULL,
	`listed` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`birth_date` text,
	`locale` text DEFAULT 'it' NOT NULL,
	`email_opt_in` integer DEFAULT true NOT NULL,
	`sms_opt_in` integer DEFAULT true NOT NULL,
	`preferred_channel` text DEFAULT 'sms' NOT NULL,
	`notes` text,
	`no_show_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `patients_org_email_idx` ON `patients` (`org_id`,`email`);--> statement-breakpoint
CREATE INDEX `patients_org_phone_idx` ON `patients` (`org_id`,`phone`);--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);--> statement-breakpoint
CREATE TABLE `practitioner_services` (
	`practitioner_id` text NOT NULL,
	`service_id` text NOT NULL,
	PRIMARY KEY(`practitioner_id`, `service_id`),
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `practitioners` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text,
	`slug` text NOT NULL,
	`title` text DEFAULT 'Dr.' NOT NULL,
	`name` text NOT NULL,
	`specialty` text NOT NULL,
	`bio` text,
	`languages` text DEFAULT 'Italiano, English' NOT NULL,
	`color` text DEFAULT '#0d9488' NOT NULL,
	`license_number` text,
	`accepts_new_patients` integer DEFAULT true NOT NULL,
	`ics_token` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practitioners_org_slug_idx` ON `practitioners` (`org_id`,`slug`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`kind` text NOT NULL,
	`channel` text NOT NULL,
	`ask_confirmation` integer DEFAULT false NOT NULL,
	`fallback_to_email` integer DEFAULT true NOT NULL,
	`send_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`sent_at` integer,
	`error` text,
	`message_id` text,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`status`,`send_at`);--> statement-breakpoint
CREATE INDEX `reminders_appointment_idx` ON `reminders` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`practitioner_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`author_name` text NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`reply` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_appointment_id_unique` ON `reviews` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `reviews_practitioner_idx` ON `reviews` (`practitioner_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_location_idx` ON `rooms` (`location_id`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`practitioner_id` text NOT NULL,
	`location_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`valid_from` text,
	`valid_until` text,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_practitioner_idx` ON `schedules` (`practitioner_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`buffer_minutes` integer DEFAULT 0 NOT NULL,
	`price_cents` integer,
	`online_bookable` integer DEFAULT true NOT NULL,
	`requires_room` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_org_idx` ON `services` (`org_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`org_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `time_off` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`practitioner_id` text,
	`location_id` text,
	`room_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `time_off_org_range_idx` ON `time_off` (`org_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`service_id` text NOT NULL,
	`practitioner_id` text,
	`location_id` text,
	`earliest_date` text NOT NULL,
	`latest_date` text NOT NULL,
	`part_of_day` text DEFAULT 'any' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`offers_sent` integer DEFAULT 0 NOT NULL,
	`last_offered_at` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`practitioner_id`) REFERENCES `practitioners`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `waitlist_org_status_idx` ON `waitlist` (`org_id`,`status`);