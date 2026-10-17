CREATE TABLE `inventory_items` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`name` varchar(180) NOT NULL,
	`sku` varchar(80),
	`category` varchar(100),
	`unit` varchar(40) NOT NULL DEFAULT 'item',
	`quantity_on_hand` int NOT NULL DEFAULT 0,
	`reorder_level` int NOT NULL DEFAULT 0,
	`location` varchar(120),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_items_school_sku_unique` UNIQUE(`school_id`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`item_id` varchar(36) NOT NULL,
	`movement_type` enum('received','issued') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`recorded_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`employee_number` varchar(80) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`email` varchar(254),
	`phone` varchar(40),
	`job_title` varchar(120) NOT NULL,
	`hired_on` date,
	`status` enum('active','on_leave','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_members_school_employee_unique` UNIQUE(`school_id`,`employee_number`),
	CONSTRAINT `staff_members_school_user_unique` UNIQUE(`school_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_item_id_inventory_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_recorded_by_auth_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `auth_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_members` ADD CONSTRAINT `staff_members_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `inventory_items_school_name_idx` ON `inventory_items` (`school_id`,`name`);--> statement-breakpoint
CREATE INDEX `inventory_movements_school_item_idx` ON `inventory_movements` (`school_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `inventory_movements_created_idx` ON `inventory_movements` (`school_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `staff_members_school_name_idx` ON `staff_members` (`school_id`,`last_name`,`first_name`);