CREATE TABLE `school_generated_materials` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`resource_id` varchar(36),
	`grade_level_id` varchar(36),
	`subject_id` varchar(36),
	`created_by` varchar(36),
	`kind` enum('lesson_plan','lecture_notes','assignment','exam') NOT NULL,
	`scope` varchar(200) NOT NULL,
	`instructions` text,
	`title` varchar(200) NOT NULL,
	`status` enum('generating','ready','failed','approved') NOT NULL DEFAULT 'generating',
	`content` json,
	`error` varchar(500),
	`model` varchar(60) NOT NULL,
	`input_tokens` int,
	`cached_input_tokens` int,
	`output_tokens` int,
	`lesson_plan_id` varchar(36),
	`assessment_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_generated_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD `ai_file_id` varchar(80);--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_generated_materials_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_generated_materials_created_by_school_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_gm_resource_fk` FOREIGN KEY (`resource_id`) REFERENCES `school_learning_resources`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_gm_grade_level_fk` FOREIGN KEY (`grade_level_id`) REFERENCES `school_grade_levels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_gm_subject_fk` FOREIGN KEY (`subject_id`) REFERENCES `school_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_gm_lesson_plan_fk` FOREIGN KEY (`lesson_plan_id`) REFERENCES `school_lesson_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_generated_materials` ADD CONSTRAINT `school_gm_assessment_fk` FOREIGN KEY (`assessment_id`) REFERENCES `school_assessments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_generated_materials_school_created_idx` ON `school_generated_materials` (`school_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `school_generated_materials_resource_idx` ON `school_generated_materials` (`resource_id`);