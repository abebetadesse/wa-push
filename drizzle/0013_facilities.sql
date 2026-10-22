CREATE TABLE `school_facilities` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`kind` enum('lab','workshop') NOT NULL,
	`name` varchar(120) NOT NULL,
	`location` varchar(120),
	`capacity` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_facilities_school_kind_name_unique` UNIQUE(`school_id`,`kind`,`name`)
);
--> statement-breakpoint
CREATE TABLE `school_facility_bookings` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`facility_id` varchar(36) NOT NULL,
	`date` date NOT NULL,
	`start_time` varchar(5) NOT NULL,
	`end_time` varchar(5) NOT NULL,
	`teacher_id` varchar(36),
	`classroom_id` varchar(36),
	`purpose` varchar(200) NOT NULL,
	`status` enum('booked','completed','cancelled') NOT NULL DEFAULT 'booked',
	`booked_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_facility_bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_facility_items` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`facility_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('equipment','chemical','consumable','tool','safety') NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(30) NOT NULL DEFAULT 'item',
	`reorder_level` int NOT NULL DEFAULT 0,
	`asset_tag` varchar(60),
	`hazard` varchar(80),
	`condition` enum('good','needs_repair','out_of_service') NOT NULL DEFAULT 'good',
	`expires_on` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_facility_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_facility_logs` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`facility_id` varchar(36) NOT NULL,
	`item_id` varchar(36),
	`log_type` enum('incident','maintenance') NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`occurred_on` date NOT NULL,
	`description` varchar(1000) NOT NULL,
	`action_taken` varchar(1000),
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`reported_by` varchar(36),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_facility_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_facilities` ADD CONSTRAINT `school_facilities_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_bookings` ADD CONSTRAINT `school_facility_bookings_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_bookings` ADD CONSTRAINT `school_facility_bookings_facility_id_school_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `school_facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_bookings` ADD CONSTRAINT `school_facility_bookings_teacher_id_school_teachers_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `school_teachers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_bookings` ADD CONSTRAINT `school_facility_bookings_classroom_id_school_classrooms_id_fk` FOREIGN KEY (`classroom_id`) REFERENCES `school_classrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_bookings` ADD CONSTRAINT `school_facility_bookings_booked_by_school_auth_users_id_fk` FOREIGN KEY (`booked_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_items` ADD CONSTRAINT `school_facility_items_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_items` ADD CONSTRAINT `school_facility_items_facility_id_school_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `school_facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_logs` ADD CONSTRAINT `school_facility_logs_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_logs` ADD CONSTRAINT `school_facility_logs_facility_id_school_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `school_facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_logs` ADD CONSTRAINT `school_facility_logs_item_id_school_facility_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `school_facility_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_facility_logs` ADD CONSTRAINT `school_facility_logs_reported_by_school_auth_users_id_fk` FOREIGN KEY (`reported_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_facility_bookings_facility_date_idx` ON `school_facility_bookings` (`facility_id`,`date`);--> statement-breakpoint
CREATE INDEX `school_facility_items_facility_idx` ON `school_facility_items` (`facility_id`,`name`);--> statement-breakpoint
CREATE INDEX `school_facility_logs_facility_idx` ON `school_facility_logs` (`facility_id`,`occurred_on`);