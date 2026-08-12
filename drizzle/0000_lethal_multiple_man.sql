CREATE TABLE `sop_counters` (
	`department` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sop_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`sop_id` text NOT NULL,
	`position` integer NOT NULL,
	`instruction` text NOT NULL,
	`image_key` text,
	`image_name` text,
	`image_type` text,
	`image_caption` text,
	FOREIGN KEY (`sop_id`) REFERENCES `sops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sop_steps_position` ON `sop_steps` (`sop_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_sop_steps_sop_id` ON `sop_steps` (`sop_id`);--> statement-breakpoint
CREATE TABLE `sops` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`department` text NOT NULL,
	`author` text NOT NULL,
	`created_date` text NOT NULL,
	`version` text NOT NULL,
	`review_date` text,
	`status` text DEFAULT 'Published' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sops_reference` ON `sops` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_sops_department_created` ON `sops` (`department`,`created_at`);