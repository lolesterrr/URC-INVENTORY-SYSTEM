CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`email_sent` integer DEFAULT false NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alerts_item_idx` ON `alerts` (`item_id`,`type`,`status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`user_id` text,
	`username` text NOT NULL,
	`role` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`details` text NOT NULL,
	`before` text,
	`after` text,
	`ip` text
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `hardware` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_name` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`engraved_number` text DEFAULT '' NOT NULL,
	`operating_system` text DEFAULT '' NOT NULL,
	`ram` text DEFAULT '' NOT NULL,
	`hard_disk` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'In Stock' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`assigned_to` text DEFAULT 'Unassigned' NOT NULL,
	`year_of_purchase` text DEFAULT '' NOT NULL,
	`date_acquired` text DEFAULT '' NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`stock_level` integer DEFAULT 1 NOT NULL,
	`reorder_level` integer DEFAULT 0 NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`port_count` text DEFAULT '' NOT NULL,
	`firmware_version` text DEFAULT '' NOT NULL,
	`server_role` text DEFAULT '' NOT NULL,
	`cpu_cores` text DEFAULT '' NOT NULL,
	`connection_type` text DEFAULT '' NOT NULL,
	`print_technology` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hardware_serial_idx` ON `hardware` (`serial_number`);--> statement-breakpoint
CREATE INDEX `hardware_department_idx` ON `hardware` (`department`);--> statement-breakpoint
CREATE TABLE `server_components` (
	`id` text PRIMARY KEY NOT NULL,
	`server_name` text NOT NULL,
	`part_name` text NOT NULL,
	`serial_number` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'Healthy' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `software` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`license_key` text DEFAULT '' NOT NULL,
	`seat_capacity` integer DEFAULT 0 NOT NULL,
	`active_seats` integer DEFAULT 0 NOT NULL,
	`expiry_date` text DEFAULT '' NOT NULL,
	`subscription_cost` real DEFAULT 0 NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`failed_logins` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);