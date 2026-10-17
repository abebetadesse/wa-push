CREATE TABLE `activity_events` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`detail` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_invitations` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`invited_by` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`role` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`accepted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_invitations_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `impersonated_by` varchar(36);--> statement-breakpoint
ALTER TABLE `auth_users` ADD `role` varchar(255) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_users` ADD `banned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_users` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `auth_users` ADD `ban_expires` timestamp;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD `created_by` varchar(36);--> statement-breakpoint
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_events` ADD CONSTRAINT `activity_events_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_invitations` ADD CONSTRAINT `school_invitations_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_invitations` ADD CONSTRAINT `school_invitations_invited_by_auth_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `auth_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_events_school_created_idx` ON `activity_events` (`school_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `school_invitations_school_email_idx` ON `school_invitations` (`school_id`,`email`);--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_created_by_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;