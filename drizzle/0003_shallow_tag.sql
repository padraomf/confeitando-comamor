CREATE TABLE `whatsapp_bridge` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`desired` text DEFAULT 'disconnected' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'offline' NOT NULL,
	`qr` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`last_seen` integer DEFAULT 0 NOT NULL,
	`runner` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`recipient` text NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL,
	`worker_id` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`message_id` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `whatsapp_outbox_status_created` ON `whatsapp_outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `whatsapp_pairing` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
