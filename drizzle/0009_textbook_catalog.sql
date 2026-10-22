CREATE TABLE `school_textbook_catalog` (
	`id` varchar(36) NOT NULL,
	`grade` int NOT NULL,
	`subject_name` varchar(120) NOT NULL,
	`language` varchar(40) NOT NULL,
	`kind` enum('student_textbook','teacher_guide') NOT NULL DEFAULT 'student_textbook',
	`title` varchar(200) NOT NULL,
	`publisher` varchar(160) NOT NULL,
	`source_url` varchar(1000) NOT NULL,
	`source_url_hash` char(64) NOT NULL,
	`direct_download` boolean NOT NULL DEFAULT true,
	`size_bytes` int,
	`check_status` enum('unchecked','ok','missing','unreachable') NOT NULL DEFAULT 'unchecked',
	`checked_at` timestamp,
	`added_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_textbook_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_textbook_catalog_source_unique` UNIQUE(`source_url_hash`)
);--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD `catalog_entry_id` varchar(36);--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD CONSTRAINT `school_learning_resources_school_catalog_unique` UNIQUE(`school_id`,`catalog_entry_id`);--> statement-breakpoint
ALTER TABLE `school_textbook_catalog` ADD CONSTRAINT `school_textbook_catalog_added_by_school_auth_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_textbook_catalog_grade_subject_idx` ON `school_textbook_catalog` (`grade`,`subject_name`);--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD CONSTRAINT `school_lr_catalog_entry_fk` FOREIGN KEY (`catalog_entry_id`) REFERENCES `school_textbook_catalog`(`id`) ON DELETE set null ON UPDATE no action;
