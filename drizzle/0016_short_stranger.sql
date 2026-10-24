ALTER TABLE `school_assessments` ADD `due_on` date;--> statement-breakpoint
ALTER TABLE `school_attendance_records` ADD `guardian_notified_at` timestamp;--> statement-breakpoint
ALTER TABLE `school_students` ADD `guardian_email` varchar(254);