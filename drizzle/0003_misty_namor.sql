CREATE TABLE `assessment_questions` (
	`id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`question_text` text NOT NULL,
	`options` json NOT NULL,
	`correct_option` int NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_results` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`score` int NOT NULL,
	`feedback` varchar(500),
	`marked_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_results_assessment_student_unique` UNIQUE(`assessment_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`created_by` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`subject_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`instructions` text,
	`status` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
	`max_score` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assessment_questions` ADD CONSTRAINT `assessment_questions_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_results` ADD CONSTRAINT `assessment_results_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_results` ADD CONSTRAINT `assessment_results_assessment_id_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_results` ADD CONSTRAINT `assessment_results_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessment_results` ADD CONSTRAINT `assessment_results_marked_by_auth_users_id_fk` FOREIGN KEY (`marked_by`) REFERENCES `auth_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_created_by_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `auth_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assessment_questions_assessment_order_idx` ON `assessment_questions` (`assessment_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `assessment_results_school_student_idx` ON `assessment_results` (`school_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `assessments_school_class_idx` ON `assessments` (`school_id`,`classroom_id`);--> statement-breakpoint
CREATE INDEX `assessments_creator_idx` ON `assessments` (`created_by`);