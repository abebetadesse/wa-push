CREATE TABLE `school_staff_attendance` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`date` date NOT NULL,
	`status` enum('present','absent','late','on_leave') NOT NULL,
	`remarks` varchar(255),
	`recorded_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_staff_attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_staff_attendance_staff_date_unique` UNIQUE(`staff_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `school_staff_contracts` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`contract_type` enum('permanent','fixed_term','temporary','part_time','volunteer') NOT NULL,
	`position` varchar(120) NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date,
	`notes` varchar(500),
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_staff_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_staff_leave` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`leave_type` enum('annual','sick','maternity','paternity','bereavement','study','unpaid','other') NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date NOT NULL,
	`reason` varchar(500),
	`status` enum('requested','approved','rejected','cancelled') NOT NULL DEFAULT 'requested',
	`decided_by` varchar(36),
	`decided_at` timestamp,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_staff_leave_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_invitations` MODIFY COLUMN `role` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL;--> statement-breakpoint
ALTER TABLE `school_memberships` MODIFY COLUMN `role` enum('school_admin','teacher','student','guardian','inventory_manager','hr_manager','librarian','lab_technician','workshop_manager','community_officer','pr_officer') NOT NULL;--> statement-breakpoint
ALTER TABLE `school_staff_attendance` ADD CONSTRAINT `school_staff_attendance_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_attendance` ADD CONSTRAINT `school_staff_attendance_staff_id_school_staff_members_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `school_staff_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_attendance` ADD CONSTRAINT `school_staff_attendance_recorded_by_school_auth_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_contracts` ADD CONSTRAINT `school_staff_contracts_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_contracts` ADD CONSTRAINT `school_staff_contracts_staff_id_school_staff_members_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `school_staff_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_leave` ADD CONSTRAINT `school_staff_leave_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_leave` ADD CONSTRAINT `school_staff_leave_staff_id_school_staff_members_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `school_staff_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_leave` ADD CONSTRAINT `school_staff_leave_decided_by_school_auth_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_staff_leave` ADD CONSTRAINT `school_staff_leave_created_by_school_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_staff_attendance_school_date_idx` ON `school_staff_attendance` (`school_id`,`date`);--> statement-breakpoint
CREATE INDEX `school_staff_contracts_school_staff_idx` ON `school_staff_contracts` (`school_id`,`staff_id`);--> statement-breakpoint
CREATE INDEX `school_staff_leave_school_start_idx` ON `school_staff_leave` (`school_id`,`starts_on`);--> statement-breakpoint
CREATE INDEX `school_staff_leave_staff_idx` ON `school_staff_leave` (`staff_id`);