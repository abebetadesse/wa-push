CREATE TABLE `academic_years` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date NOT NULL,
	`is_current` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_years_school_name_unique` UNIQUE(`school_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`grade_level_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`capacity` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `classrooms_year_name_unique` UNIQUE(`academic_year_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`status` enum('enrolled','completed','withdrawn') NOT NULL DEFAULT 'enrolled',
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollments_student_year_unique` UNIQUE(`student_id`,`academic_year_id`)
);
--> statement-breakpoint
CREATE TABLE `grade_levels` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `grade_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `grade_levels_school_name_unique` UNIQUE(`school_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` varchar(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`email` varchar(254),
	`phone` varchar(40),
	`country` varchar(100),
	`timezone` varchar(64) NOT NULL DEFAULT 'Africa/Nairobi',
	`status` enum('active','trial','suspended') NOT NULL DEFAULT 'trial',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`),
	CONSTRAINT `schools_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`student_number` varchar(80) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`email` varchar(254),
	`date_of_birth` date,
	`status` enum('active','inactive','graduated','transferred') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_school_number_unique` UNIQUE(`school_id`,`student_number`)
);
--> statement-breakpoint
ALTER TABLE `academic_years` ADD CONSTRAINT `academic_years_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_grade_level_id_grade_levels_id_fk` FOREIGN KEY (`grade_level_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grade_levels` ADD CONSTRAINT `grade_levels_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `academic_years_school_idx` ON `academic_years` (`school_id`);--> statement-breakpoint
CREATE INDEX `classrooms_school_year_idx` ON `classrooms` (`school_id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `enrollments_school_class_idx` ON `enrollments` (`school_id`,`classroom_id`);--> statement-breakpoint
CREATE INDEX `grade_levels_school_idx` ON `grade_levels` (`school_id`);--> statement-breakpoint
CREATE INDEX `students_school_name_idx` ON `students` (`school_id`,`last_name`,`first_name`);