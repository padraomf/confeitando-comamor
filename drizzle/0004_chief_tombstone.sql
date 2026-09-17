CREATE TABLE `admin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_accounts_login_unique` ON `admin_accounts` (`login`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `admin_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_account` ON `admin_sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `budget_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`budget_id` text,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `budget_attachments_user` ON `budget_attachments` (`user_id`,`budget_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_request_id_unique` ON `budgets` (`request_id`);--> statement-breakpoint
CREATE INDEX `budgets_user_created` ON `budgets` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `budgets_created` ON `budgets` (`created_at`);