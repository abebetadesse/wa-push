CREATE TABLE `attendance_records` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`class_schedule_id` varchar(36),
	`classroom_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`date` date NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`remarks` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_student_class_date_unique` UNIQUE(`student_id`,`classroom_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(100) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`scope` text,
	`password` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`ip_address` varchar(45),
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_schedules` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36) NOT NULL,
	`subject_id` varchar(36) NOT NULL,
	`teacher_id` varchar(36),
	`lesson_plan_id` varchar(36),
	`day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
	`start_time` varchar(10) NOT NULL,
	`end_time` varchar(10) NOT NULL,
	`room_number` varchar(50),
	`status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_plans` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`academic_year_id` varchar(36) NOT NULL,
	`grade_level_id` varchar(36) NOT NULL,
	`subject_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36),
	`teacher_id` varchar(36),
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
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_memberships` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_memberships_school_user_unique` UNIQUE(`school_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(30),
	`department` varchar(100),
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_school_name_unique` UNIQUE(`school_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`teacher_number` varchar(80) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`email` varchar(254),
	`phone` varchar(40),
	`specialization` varchar(150),
	`status` enum('active','on_leave','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachers_id` PRIMARY KEY(`id`),
	CONSTRAINT `teachers_school_number_unique` UNIQUE(`school_id`,`teacher_number`)
);
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_class_schedule_id_class_schedules_id_fk` FOREIGN KEY (`class_schedule_id`) REFERENCES `class_schedules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_accounts` ADD CONSTRAINT `auth_accounts_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_teacher_id_teachers_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_schedules` ADD CONSTRAINT `class_schedules_lesson_plan_id_lesson_plans_id_fk` FOREIGN KEY (`lesson_plan_id`) REFERENCES `lesson_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_academic_year_id_academic_years_id_fk` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_grade_level_id_grade_levels_id_fk` FOREIGN KEY (`grade_level_id`) REFERENCES `grade_levels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_classroom_id_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_teacher_id_teachers_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_memberships` ADD CONSTRAINT `school_memberships_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_memberships` ADD CONSTRAINT `school_memberships_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attendance_school_date_idx` ON `attendance_records` (`school_id`,`date`);--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier_idx` ON `auth_verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `class_schedules_classroom_idx` ON `class_schedules` (`classroom_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX `class_schedules_teacher_idx` ON `class_schedules` (`teacher_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX `class_schedules_school_idx` ON `class_schedules` (`school_id`);--> statement-breakpoint
CREATE INDEX `lesson_plans_school_subject_idx` ON `lesson_plans` (`school_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `lesson_plans_teacher_idx` ON `lesson_plans` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `lesson_plans_scheduled_date_idx` ON `lesson_plans` (`school_id`,`scheduled_date`);--> statement-breakpoint
CREATE INDEX `school_memberships_user_idx` ON `school_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `subjects_school_idx` ON `subjects` (`school_id`);--> statement-breakpoint
CREATE INDEX `teachers_school_name_idx` ON `teachers` (`school_id`,`last_name`,`first_name`);