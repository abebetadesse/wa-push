ALTER TABLE `school_memberships` MODIFY COLUMN `role` enum('school_admin','supervisor','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL;--> statement-breakpoint
ALTER TABLE `school_invitations` MODIFY COLUMN `role` enum('school_admin','supervisor','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL;--> statement-breakpoint
CREATE TABLE `school_org_units` (
	`id` varchar(36) NOT NULL,
	`level` enum('region','zone','woreda','cluster') NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(40),
	`parent_id` varchar(36),
	`description` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_org_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_org_units_parent_name_unique` UNIQUE(`parent_id`,`level`,`name`)
);
--> statement-breakpoint
ALTER TABLE `school_org_units` ADD CONSTRAINT `school_org_units_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `school_org_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_org_units_level_idx` ON `school_org_units` (`level`);--> statement-breakpoint
ALTER TABLE `school_schools` ADD `org_unit_id` varchar(36);--> statement-breakpoint
ALTER TABLE `school_schools` ADD `school_code` varchar(40);--> statement-breakpoint
ALTER TABLE `school_schools` ADD `kebele` varchar(120);--> statement-breakpoint
ALTER TABLE `school_schools` ADD `student_registration_open` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `school_schools` ADD CONSTRAINT `school_schools_org_unit_fk` FOREIGN KEY (`org_unit_id`) REFERENCES `school_org_units`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_schools_org_unit_idx` ON `school_schools` (`org_unit_id`);--> statement-breakpoint
ALTER TABLE `school_students` ADD `gender` enum('female','male');--> statement-breakpoint
ALTER TABLE `school_teachers` ADD `gender` enum('female','male');--> statement-breakpoint
CREATE TABLE `school_org_memberships` (
	`id` varchar(36) NOT NULL,
	`org_unit_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('org_admin','supervisor') NOT NULL,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_org_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_org_memberships_unit_user_unique` UNIQUE(`org_unit_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `school_org_memberships` ADD CONSTRAINT `school_org_memberships_unit_fk` FOREIGN KEY (`org_unit_id`) REFERENCES `school_org_units`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_org_memberships` ADD CONSTRAINT `school_org_memberships_user_fk` FOREIGN KEY (`user_id`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_org_memberships` ADD CONSTRAINT `school_org_memberships_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_org_memberships_user_idx` ON `school_org_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `school_role_permissions` (
	`id` varchar(36) NOT NULL,
	`scope_type` enum('platform','org_unit','school') NOT NULL,
	`scope_id` varchar(36) NOT NULL DEFAULT '',
	`role` varchar(40) NOT NULL,
	`resource` varchar(40) NOT NULL,
	`actions` json NOT NULL,
	`updated_by` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_role_permissions_unique` UNIQUE(`scope_type`,`scope_id`,`role`,`resource`)
);
--> statement-breakpoint
ALTER TABLE `school_role_permissions` ADD CONSTRAINT `school_role_permissions_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE `school_field_definitions` (
	`id` varchar(36) NOT NULL,
	`scope_type` enum('platform','org_unit','school') NOT NULL,
	`scope_id` varchar(36) NOT NULL DEFAULT '',
	`entity` enum('school','student','teacher','staff') NOT NULL,
	`field_key` varchar(60) NOT NULL,
	`label` varchar(160) NOT NULL,
	`label_local` varchar(200),
	`field_type` varchar(30) NOT NULL,
	`section` varchar(100),
	`options` json,
	`config` json,
	`required` boolean NOT NULL DEFAULT false,
	`help_text` varchar(300),
	`sort_order` int NOT NULL DEFAULT 0,
	`edit_roles` json,
	`view_roles` json,
	`is_periodic` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_field_definitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_field_definitions_key_unique` UNIQUE(`scope_type`,`scope_id`,`entity`,`field_key`)
);
--> statement-breakpoint
ALTER TABLE `school_field_definitions` ADD CONSTRAINT `school_field_definitions_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_field_definitions_entity_idx` ON `school_field_definitions` (`entity`,`is_active`);--> statement-breakpoint
CREATE TABLE `school_field_values` (
	`id` varchar(36) NOT NULL,
	`field_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`entity` enum('school','student','teacher','staff') NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`period` varchar(20) NOT NULL DEFAULT '',
	`value` json,
	`updated_by` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_field_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_field_values_unique` UNIQUE(`field_id`,`entity_id`,`period`)
);
--> statement-breakpoint
ALTER TABLE `school_field_values` ADD CONSTRAINT `school_field_values_field_fk` FOREIGN KEY (`field_id`) REFERENCES `school_field_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_field_values` ADD CONSTRAINT `school_field_values_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_field_values` ADD CONSTRAINT `school_field_values_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_field_values_school_entity_idx` ON `school_field_values` (`school_id`,`entity`,`period`);--> statement-breakpoint
CREATE TABLE `school_saved_reports` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` varchar(500),
	`config` json NOT NULL,
	`is_shared` boolean NOT NULL DEFAULT false,
	`pinned` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_saved_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_saved_reports` ADD CONSTRAINT `school_saved_reports_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_saved_reports_owner_idx` ON `school_saved_reports` (`owner_id`);--> statement-breakpoint
CREATE TABLE `school_certificate_templates` (
	`id` varchar(36) NOT NULL,
	`scope_type` enum('platform','org_unit','school') NOT NULL,
	`scope_id` varchar(36) NOT NULL DEFAULT '',
	`name` varchar(160) NOT NULL,
	`audience` enum('student','teacher','staff') NOT NULL,
	`design` json NOT NULL,
	`elements` json NOT NULL,
	`variables` json NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_certificate_templates` ADD CONSTRAINT `school_certificate_templates_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_certificate_templates_scope_idx` ON `school_certificate_templates` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `school_certificates` (
	`id` varchar(36) NOT NULL,
	`template_id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`recipient_type` enum('student','teacher','staff') NOT NULL,
	`recipient_id` varchar(36) NOT NULL,
	`recipient_name` varchar(220) NOT NULL,
	`serial` varchar(40) NOT NULL,
	`verification_code` varchar(16) NOT NULL,
	`data` json NOT NULL,
	`issued_by` varchar(36),
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `school_certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_certificates_serial_unique` UNIQUE(`serial`),
	CONSTRAINT `school_certificates_code_unique` UNIQUE(`verification_code`)
);
--> statement-breakpoint
ALTER TABLE `school_certificates` ADD CONSTRAINT `school_certificates_template_fk` FOREIGN KEY (`template_id`) REFERENCES `school_certificate_templates`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_certificates` ADD CONSTRAINT `school_certificates_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_certificates` ADD CONSTRAINT `school_certificates_issued_by_fk` FOREIGN KEY (`issued_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_certificates_recipient_idx` ON `school_certificates` (`recipient_type`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `school_certificates_school_idx` ON `school_certificates` (`school_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `school_discussion_threads` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`classroom_id` varchar(36),
	`subject_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`pinned` boolean NOT NULL DEFAULT false,
	`locked` boolean NOT NULL DEFAULT false,
	`hidden` boolean NOT NULL DEFAULT false,
	`last_activity_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_discussion_threads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_discussion_threads` ADD CONSTRAINT `school_discussion_threads_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_discussion_threads` ADD CONSTRAINT `school_discussion_threads_classroom_fk` FOREIGN KEY (`classroom_id`) REFERENCES `school_classrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_discussion_threads` ADD CONSTRAINT `school_discussion_threads_subject_fk` FOREIGN KEY (`subject_id`) REFERENCES `school_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_discussion_threads` ADD CONSTRAINT `school_discussion_threads_author_fk` FOREIGN KEY (`author_id`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_discussion_threads_school_idx` ON `school_discussion_threads` (`school_id`,`last_activity_at`);--> statement-breakpoint
CREATE TABLE `school_discussion_posts` (
	`id` varchar(36) NOT NULL,
	`thread_id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`hidden` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_discussion_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_discussion_posts` ADD CONSTRAINT `school_discussion_posts_thread_fk` FOREIGN KEY (`thread_id`) REFERENCES `school_discussion_threads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_discussion_posts` ADD CONSTRAINT `school_discussion_posts_author_fk` FOREIGN KEY (`author_id`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_discussion_posts_thread_idx` ON `school_discussion_posts` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `school_student_applications` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`student_number` varchar(80),
	`gender` enum('female','male'),
	`date_of_birth` date,
	`grade_name` varchar(80),
	`guardian_phone` varchar(40),
	`message` varchar(1000),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewed_by` varchar(36),
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_student_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_student_applications_school_user_unique` UNIQUE(`school_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `school_student_applications` ADD CONSTRAINT `school_student_applications_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_student_applications` ADD CONSTRAINT `school_student_applications_user_fk` FOREIGN KEY (`user_id`) REFERENCES `school_auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_student_applications` ADD CONSTRAINT `school_student_applications_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_student_applications_school_idx` ON `school_student_applications` (`school_id`,`status`);
--> statement-breakpoint
CREATE TABLE `school_field_files` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`field_id` varchar(36) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`storage_key` varchar(36) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`content_type` varchar(120) NOT NULL,
	`size_bytes` int NOT NULL,
	`uploaded_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_field_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_field_files_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
ALTER TABLE `school_field_files` ADD CONSTRAINT `school_field_files_school_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_field_files` ADD CONSTRAINT `school_field_files_field_fk` FOREIGN KEY (`field_id`) REFERENCES `school_field_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_field_files` ADD CONSTRAINT `school_field_files_uploaded_by_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_field_files_field_entity_idx` ON `school_field_files` (`field_id`,`entity_id`);
