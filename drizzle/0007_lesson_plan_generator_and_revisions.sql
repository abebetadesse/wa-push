CREATE TABLE IF NOT EXISTS `school_lesson_plan_revisions` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`lesson_plan_id` varchar(36) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`edited_by` varchar(36),
	`change_summary` varchar(255) NOT NULL DEFAULT 'Updated lesson plan',
	`title` varchar(200) NOT NULL,
	`unit_topic` varchar(160),
	`duration_minutes` int NOT NULL DEFAULT 45,
	`scheduled_date` date,
	`status` enum('draft','submitted','approved','published','archived') NOT NULL DEFAULT 'draft',
	`overview` text,
	`objectives` text,
	`materials` text,
	`prerequisites` text,
	`procedures` text,
	`differentiation` text,
	`assessment` text,
	`homework` text,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_lesson_plan_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_lesson_plans` ADD COLUMN `source_resource_id` varchar(36);
--> statement-breakpoint
CREATE INDEX `school_lesson_plans_source_resource_idx` ON `school_lesson_plans` (`source_resource_id`);
--> statement-breakpoint
CREATE INDEX `school_lesson_revisions_plan_idx` ON `school_lesson_plan_revisions` (`lesson_plan_id`,`version`);
--> statement-breakpoint
CREATE INDEX `school_lesson_revisions_school_idx` ON `school_lesson_plan_revisions` (`school_id`);
--> statement-breakpoint
ALTER TABLE `school_lesson_plan_revisions` ADD CONSTRAINT `school_lesson_revisions_school_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `school_lesson_plan_revisions` ADD CONSTRAINT `school_lesson_revisions_lesson_plan_id_fk` FOREIGN KEY (`lesson_plan_id`) REFERENCES `school_lesson_plans`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `school_lesson_plan_revisions` ADD CONSTRAINT `school_lesson_revisions_edited_by_fk` FOREIGN KEY (`edited_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `school_lesson_plans` ADD CONSTRAINT `school_lesson_plans_source_resource_id_fk` FOREIGN KEY (`source_resource_id`) REFERENCES `school_learning_resources`(`id`) ON DELETE set null ON UPDATE no action;
