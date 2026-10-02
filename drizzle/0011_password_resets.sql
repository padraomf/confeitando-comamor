CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`phone` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer NOT NULL DEFAULT 0
);
-->statement-breakpoint
CREATE INDEX `password_resets_customer` ON `password_resets` (`customer_id`);
