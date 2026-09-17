CREATE TABLE `commerce_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "commerce_guard_valid" CHECK("commerce_guards"."valid"=1)
);
