CREATE TABLE `image_originals` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_events_created` ON `order_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `order_events_order` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`object_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proof_order` ON `order_proofs` (`order_id`);--> statement-breakpoint
ALTER TABLE `admin_accounts` ADD `role` text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsapp_outbox` ADD `event` text DEFAULT 'Recebido' NOT NULL;