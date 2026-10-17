CREATE TABLE `assessment_attempts` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`answers` json NOT NULL,
	`score` int NOT NULL,
	`max_score` int NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_attempts_assessment_student_unique` UNIQUE(`assessment_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `learning_resources` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`uploaded_by` varchar(36),
	`title` varchar(200) NOT NULL,
	`description` text,
	`file_name` varchar(255) NOT NULL,
	`storage_key` varchar(36) NOT NULL,
	`content_type` varchar(120) NOT NULL,
	`size_bytes` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `learning_resources_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
ALTER TABLE `students` ADD `user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_school_user_unique` UNIQUE(`school_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_resources` ADD CONSTRAINT `learning_resources_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_resources` ADD CONSTRAINT `learning_resources_uploaded_by_auth_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assessment_attempts_school_assessment_idx` ON `assessment_attempts` (`school_id`,`assessment_id`);--> statement-breakpoint
CREATE INDEX `learning_resources_school_created_idx` ON `learning_resources` (`school_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;