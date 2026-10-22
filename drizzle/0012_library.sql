CREATE TABLE `school_library_books` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`author` varchar(160),
	`isbn` varchar(20),
	`publisher` varchar(160),
	`published_year` int,
	`category` varchar(80),
	`language` varchar(40),
	`grade_level_id` varchar(36),
	`subject_id` varchar(36),
	`shelf` varchar(40),
	`copies` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_library_books_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_library_books_school_isbn_unique` UNIQUE(`school_id`,`isbn`)
);
--> statement-breakpoint
CREATE TABLE `school_library_loans` (
	`id` varchar(36) NOT NULL,
	`school_id` varchar(36) NOT NULL,
	`book_id` varchar(36) NOT NULL,
	`borrower_type` enum('student','staff') NOT NULL,
	`student_id` varchar(36),
	`staff_id` varchar(36),
	`borrower_name` varchar(200) NOT NULL,
	`loaned_on` date NOT NULL,
	`due_on` date NOT NULL,
	`returned_on` date,
	`issued_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_library_loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_library_books` ADD CONSTRAINT `school_library_books_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_books` ADD CONSTRAINT `school_library_books_grade_level_id_school_grade_levels_id_fk` FOREIGN KEY (`grade_level_id`) REFERENCES `school_grade_levels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_books` ADD CONSTRAINT `school_library_books_subject_id_school_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `school_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_loans` ADD CONSTRAINT `school_library_loans_school_id_school_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `school_schools`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_loans` ADD CONSTRAINT `school_library_loans_book_id_school_library_books_id_fk` FOREIGN KEY (`book_id`) REFERENCES `school_library_books`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_loans` ADD CONSTRAINT `school_library_loans_student_id_school_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `school_students`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_loans` ADD CONSTRAINT `school_library_loans_staff_id_school_staff_members_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `school_staff_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `school_library_loans` ADD CONSTRAINT `school_library_loans_issued_by_school_auth_users_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `school_auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `school_library_books_school_title_idx` ON `school_library_books` (`school_id`,`title`);--> statement-breakpoint
CREATE INDEX `school_library_loans_school_returned_idx` ON `school_library_loans` (`school_id`,`returned_on`);--> statement-breakpoint
CREATE INDEX `school_library_loans_book_idx` ON `school_library_loans` (`book_id`);