-- Settings UI (T10a): organisation-wide settings an Admin can change without a code deploy.
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`company_name` text DEFAULT 'Uganda Railways Corporation' NOT NULL,
	`default_label_preset` text DEFAULT '24' NOT NULL,
	`default_label_width_mm` real,
	`default_label_height_mm` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
-- One row per hardware category. NULL `life_years` means that category has no replacement-life policy.
-- Seeded from the defaults T9g shipped in code (shared/reports.ts DEFAULT_REPLACEMENT_LIFE_YEARS), which
-- were never a URC-confirmed policy (PROJECT.md Q13) — they just move from code into an editable table.
CREATE TABLE `replacement_policies` (
	`category` text PRIMARY KEY NOT NULL,
	`life_years` integer
);
--> statement-breakpoint
INSERT INTO `settings` (`id`) VALUES (1);
--> statement-breakpoint
INSERT INTO `replacement_policies` (`category`, `life_years`) VALUES
	('Laptop', 4),
	('Desktop', 4),
	('Switch', 7),
	('Router', 7),
	('Server', 5),
	('Printer', 6),
	('Other', NULL);
--> statement-breakpoint
INSERT INTO `audit_log` (`username`, `role`, `action`, `details`)
VALUES ('system', 'system', 'Migrate Settings',
  'Added the settings table (company name, default label size) and the replacement-life policy table, seeded with the same category defaults the reports feature used in code.');
