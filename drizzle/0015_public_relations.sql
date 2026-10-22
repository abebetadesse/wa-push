CREATE TABLE `school_pr_media` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`storage_key` varchar(36) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`content_type` varchar(60) NOT NULL,
	`size_bytes` int NOT NULL,
	`caption` varchar(300),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`admin_feedback` varchar(1000),
	`uploaded_by` varchar(36),
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_pr_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_pr_media_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `school_pr_posts` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`post_type` enum('news','announcement','achievement','event_recap') NOT NULL,
	`title` varchar(200) NOT NULL,
	`summary` varchar(300) NOT NULL,
	`body` text NOT NULL,
	`cover_media_id` varchar(36),
	`status` enum('draft','submitted','changes_requested','published','archived') NOT NULL DEFAULT 'draft',
	`admin_feedback` text,
	`author_id` varchar(36),
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_pr_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_public_profiles` (
	`school_id` varchar(36) NOT NULL,
	`tagline` varchar(160),
	`about` text,
	`mission` varchar(600),
	`vision` varchar(600),
	`principal_name` varchar(120),
	`principal_message` text,
	`address` varchar(200),
	`phone` varchar(40),
	`email` varchar(254),
	`hero_media_id` varchar(36),
	`status` enum('draft','submitted','changes_requested','approved') NOT NULL DEFAULT 'draft',
	`admin_feedback` text,
	`published_content` json,
	`is_published` boolean NOT NULL DEFAULT false,
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_public_profiles_school_id` PRIMARY KEY(`school_id`)
);
--> statement-breakpoint
ALTER TABLE `school_pr_media` ADD CONSTRAINT `school_pr_media_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_media` ADD CONSTRAINT `school_pr_media_uploaded_by_school_auth_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_media` ADD CONSTRAINT `school_pr_media_reviewed_by_school_auth_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_posts` ADD CONSTRAINT `school_pr_posts_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_posts` ADD CONSTRAINT `school_pr_posts_cover_media_id_school_pr_media_id_fk` FOREIGN KEY (`cover_media_id`) REFERENCES `school_pr_media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_posts` ADD CONSTRAINT `school_pr_posts_author_id_school_auth_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_pr_posts` ADD CONSTRAINT `school_pr_posts_reviewed_by_school_auth_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_public_profiles` ADD CONSTRAINT `school_public_profiles_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_public_profiles` ADD CONSTRAINT `school_public_profiles_hero_media_id_school_pr_media_id_fk` FOREIGN KEY (`hero_media_id`) REFERENCES `school_pr_media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_public_profiles` ADD CONSTRAINT `school_public_profiles_reviewed_by_school_auth_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_pr_media_school_status_idx` ON `school_pr_media` (`school_id`,`status`);--> statement-breakpoint
CREATE INDEX `school_pr_posts_school_status_idx` ON `school_pr_posts` (`school_id`,`status`,`published_at`);