CREATE TABLE `costs` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`purchase_date` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`paid_at` integer,
	`created_at` integer NOT NULL
);
CREATE INDEX `costs_created` ON `costs` (`created_at`);
