CREATE TABLE `school_teacher_reports` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36),
	`submitted_by` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`section` enum('lessons','attendance','assessments','facilities','general') NOT NULL DEFAULT 'general',
	`report_date` date NOT NULL,
	`photo_storage_key` varchar(36) NOT NULL,
	`photo_file_name` varchar(255) NOT NULL,
	`photo_content_type` varchar(60) NOT NULL,
	`photo_size_bytes` int NOT NULL,
	`transcription` text,
	`transcription_status` enum('pending','completed','edited','failed','skipped') NOT NULL DEFAULT 'pending',
	`notes` text,
	`classroom_id` varchar(36),
	`subject_id` varchar(36),
	`academic_year_id` varchar(36),
	`lesson_plan_id` varchar(36),
	`assessment_id` varchar(36),
	`status` enum('submitted','reviewed','archived') NOT NULL DEFAULT 'submitted',
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp,
	`review_feedback` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_teacher_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_teacher_fk` FOREIGN KEY (`teacher_id`) REFERENCES `school_teachers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_submitted_fk` FOREIGN KEY (`submitted_by`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_classroom_fk` FOREIGN KEY (`classroom_id`) REFERENCES `school_classrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_subject_fk` FOREIGN KEY (`subject_id`) REFERENCES `school_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_year_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `school_academic_years`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_lesson_fk` FOREIGN KEY (`lesson_plan_id`) REFERENCES `school_lesson_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_assessment_fk` FOREIGN KEY (`assessment_id`) REFERENCES `school_assessments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_teacher_reports` ADD CONSTRAINT `school_tr_reviewed_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_teacher_reports_school_section_idx` ON `school_teacher_reports` (`school_id`,`section`,`report_date`);--> statement-breakpoint
CREATE INDEX `school_teacher_reports_teacher_idx` ON `school_teacher_reports` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `school_teacher_reports_lesson_idx` ON `school_teacher_reports` (`lesson_plan_id`);--> statement-breakpoint
CREATE INDEX `school_teacher_reports_assessment_idx` ON `school_teacher_reports` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `school_teacher_reports_classroom_idx` ON `school_teacher_reports` (`classroom_id`);
