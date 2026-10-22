ALTER TABLE `school_learning_resources` ADD COLUMN `grade_level_id` varchar(36) NULL;--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD COLUMN `subject_id` varchar(36) NULL;--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD CONSTRAINT `school_lr_grade_level_fk` FOREIGN KEY (`grade_level_id`) REFERENCES `school_grade_levels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_learning_resources` ADD CONSTRAINT `school_learning_resources_subject_id_school_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `school_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_learning_resources_grade_subject_idx` ON `school_learning_resources` (`school_id`,`grade_level_id`,`subject_id`);
