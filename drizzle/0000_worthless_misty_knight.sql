CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text,
	`mess_id` text,
	`event` text NOT NULL,
	`details` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_mess_created` ON `audit` (`mess_id`,`created`);--> statement-breakpoint
CREATE TABLE `capture_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hash` text NOT NULL,
	`expires` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `festivals` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`mess_id` text,
	`items` text NOT NULL,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `festivals_date` ON `festivals` (`date`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`mess_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`items` text NOT NULL,
	`source` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`deadline` integer NOT NULL,
	`imported` integer NOT NULL,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_slot_unique` ON `meals` (`mess_id`,`date`,`slot`);--> statement-breakpoint
CREATE INDEX `meals_deadline` ON `meals` (`deadline`);--> statement-breakpoint
CREATE TABLE `messes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`caterer` text NOT NULL,
	`hostel` text NOT NULL,
	`category` text NOT NULL,
	`grace` integer DEFAULT 15 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messes_slug_unique` ON `messes` (`slug`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`sent` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`digest` text NOT NULL,
	`received` integer NOT NULL,
	`client_captured` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proofs_meal_id_unique` ON `proofs` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `proofs_digest_unique` ON `proofs` (`digest`);--> statement-breakpoint
CREATE TABLE `membership_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mess_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer` text,
	`created` integer NOT NULL,
	`decided` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_mess_status` ON `membership_requests` (`mess_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mess_id` text NOT NULL,
	`month` text NOT NULL,
	`dish` text NOT NULL,
	`normalized` text NOT NULL,
	`credit` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suggestion_once` ON `suggestions` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `suggestions_mess_month` ON `suggestions` (`mess_id`,`month`);--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mess_id` text NOT NULL,
	`month` text NOT NULL,
	`taste` integer NOT NULL,
	`quantity` integer NOT NULL,
	`hygiene` integer NOT NULL,
	`timing` integer NOT NULL,
	`comment` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_once` ON `surveys` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `survey_mess_month` ON `surveys` (`mess_id`,`month`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`login` text,
	`name` text NOT NULL,
	`registration` text,
	`role` text NOT NULL,
	`secret` text NOT NULL,
	`mess_id` text,
	`verified` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_registration_unique` ON `users` (`registration`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mess_id` text NOT NULL,
	`month` text NOT NULL,
	`dish` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mess_id`) REFERENCES `messes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vote_once` ON `votes` (`user_id`,`month`);--> statement-breakpoint
CREATE INDEX `votes_mess_month` ON `votes` (`mess_id`,`month`);--> statement-breakpoint
CREATE TABLE `warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`created` integer NOT NULL,
	`resolved` integer,
	`response` text,
	`reviewer` text,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warnings_meal_id_unique` ON `warnings` (`meal_id`);