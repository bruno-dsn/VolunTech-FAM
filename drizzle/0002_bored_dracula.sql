CREATE TABLE `actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`partner_id` integer,
	`volunteer_cpf` text DEFAULT '' NOT NULL,
	`scheduled_at` text NOT NULL,
	`participants` integer NOT NULL,
	`department` text NOT NULL,
	`source_channel` text NOT NULL,
	`documents` text DEFAULT 'Pendente' NOT NULL,
	`status` text DEFAULT 'Solicitada' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`category` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor` text NOT NULL,
	`guest_name` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`claimed_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `donation_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`donation_id` integer NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`donor` text NOT NULL,
	`item` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_received` integer NOT NULL,
	`quantity_distributed` integer DEFAULT 0 NOT NULL,
	`purpose` text NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
