CREATE TABLE `card_attempts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`state` text NOT NULL,
	`provider_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`method` text NOT NULL,
	`provider` text NOT NULL,
	`actor` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `receipts_order_date` ON `payment_receipts` (`order_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `receipts_date` ON `payment_receipts` (`occurred_at`);--> statement-breakpoint
ALTER TABLE `admin_accounts` ADD `active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_attachments` ADD `original_key` text;--> statement-breakpoint
ALTER TABLE `budget_attachments` ADD `original_type` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `received` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `stock` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `notes` text DEFAULT '' NOT NULL;