CREATE TABLE `school_community_events` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`event_type` enum('parent_meeting','ptsa_meeting','community_service','fundraiser','open_day','sports','cultural','awareness','other') NOT NULL,
	`event_date` date NOT NULL,
	`start_time` varchar(5),
	`location` varchar(160),
	`partner_id` varchar(36),
	`description` varchar(1000),
	`expected_attendance` int,
	`actual_attendance` int,
	`outcome` text,
	`status` enum('planned','held','cancelled') NOT NULL DEFAULT 'planned',
	`is_public` boolean NOT NULL DEFAULT false,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_community_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_community_partners` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`partner_type` enum('parent_association','ngo','business','government','religious','alumni','health','other') NOT NULL,
	`contact_name` varchar(120),
	`phone` varchar(40),
	`email` varchar(254),
	`notes` varchar(1000),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_community_partners_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_community_partners_school_name_unique` UNIQUE(`school_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `school_volunteers` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(40),
	`email` varchar(254),
	`skills` varchar(300),
	`availability` varchar(200),
	`partner_id` varchar(36),
	`hours_contributed` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_volunteers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_community_events` ADD CONSTRAINT `school_community_events_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_community_events` ADD CONSTRAINT `school_community_events_created_by_school_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_community_events` ADD CONSTRAINT `school_ce_partner_fk` FOREIGN KEY (`partner_id`) REFERENCES `school_community_partners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_community_partners` ADD CONSTRAINT `school_community_partners_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_volunteers` ADD CONSTRAINT `school_volunteers_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_volunteers` ADD CONSTRAINT `school_volunteers_partner_fk` FOREIGN KEY (`partner_id`) REFERENCES `school_community_partners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_community_events_school_date_idx` ON `school_community_events` (`school_id`,`event_date`);--> statement-breakpoint
CREATE INDEX `school_volunteers_school_name_idx` ON `school_volunteers` (`school_id`,`name`);