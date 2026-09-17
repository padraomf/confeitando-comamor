-- One-time reset explicitly requested by the site owner on 2026-09-17.
-- Preserves products, categories, store settings, integrations, original photos,
-- and the platform owner's recovery binding. Does not refund any payment.
DELETE FROM whatsapp_outbox;
--> statement-breakpoint
DELETE FROM notifications;
--> statement-breakpoint
DELETE FROM order_events;
--> statement-breakpoint
DELETE FROM order_proofs;
--> statement-breakpoint
DELETE FROM orders;
--> statement-breakpoint
DELETE FROM quotes;
--> statement-breakpoint
DELETE FROM budget_attachments;
--> statement-breakpoint
DELETE FROM budgets;
--> statement-breakpoint
DELETE FROM admin_sessions;
--> statement-breakpoint
DELETE FROM admin_accounts;
--> statement-breakpoint
DELETE FROM customer_sessions;
--> statement-breakpoint
DELETE FROM customers;
--> statement-breakpoint
DELETE FROM profiles;
--> statement-breakpoint
DELETE FROM oauth_states;
--> statement-breakpoint
DELETE FROM auth_limits;
