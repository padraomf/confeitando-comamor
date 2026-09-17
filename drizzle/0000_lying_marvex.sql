CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_order` ON `notifications` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	`total` integer NOT NULL,
	`status` text NOT NULL,
	`payment` text NOT NULL,
	`payment_status` text NOT NULL,
	`payment_id` text,
	`checkout_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request_id_unique` ON `orders` (`request_id`);--> statement-breakpoint
CREATE INDEX `orders_user_created` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_created` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`category` text NOT NULL,
	`image` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`tag` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`distance` integer NOT NULL,
	`fee` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
