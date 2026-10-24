CREATE TABLE `school_assessment_reminders` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_assessment_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_assessment_reminders_student_unique` UNIQUE(`assessment_id`,`student_id`)
);
--> statement-breakpoint
ALTER TABLE `school_assessment_reminders` ADD CONSTRAINT `school_ar_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_assessment_reminders` ADD CONSTRAINT `school_ar_assessment_fk` FOREIGN KEY (`assessment_id`) REFERENCES `school_assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_assessment_reminders` ADD CONSTRAINT `school_ar_student_fk` FOREIGN KEY (`student_id`) REFERENCES `school_students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_assessment_reminders_school_idx` ON `school_assessment_reminders` (`school_id`);