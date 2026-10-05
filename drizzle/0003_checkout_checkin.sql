-- Check-out / check-in: an asset_assignments row tracks who an asset is with. Only one row per
-- asset may be open (checked_in_at IS NULL) at a time, enforced by a partial unique index.
-- Changes go through POST /api/hardware/:id/checkout and /checkin.
CREATE TABLE `asset_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hardware_id` text NOT NULL,
	`assignee` text NOT NULL,
	`checked_out_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`checked_out_by` text NOT NULL,
	`due_back` text,
	`checked_in_at` text,
	`checked_in_by` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`hardware_id`) REFERENCES `hardware`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asset_assignments_hardware_idx` ON `asset_assignments` (`hardware_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_assignments_open_idx` ON `asset_assignments` (`hardware_id`) WHERE "asset_assignments"."checked_in_at" is null;
--> statement-breakpoint
-- Backfill an open assignment for every asset that is already Deployed, so the new table matches
-- what the hardware register already shows. checked_out_at is the last time the lifecycle state
-- changed, falling back to when the record was created.
INSERT INTO `asset_assignments` (`hardware_id`, `assignee`, `checked_out_at`, `checked_out_by`, `notes`)
SELECT `id`, `assigned_to`, coalesce(`lifecycle_changed_at`, `created_at`), 'system', 'Backfilled when check-out/check-in was introduced.'
FROM `hardware`
WHERE `lifecycle_state` = 'Deployed' AND trim(`assigned_to`) NOT IN ('', 'Unassigned');
--> statement-breakpoint
INSERT INTO `audit_log` (`username`, `role`, `action`, `details`)
SELECT 'system', 'system', 'Migrate Assignments',
  'Opened a check-out record for ' || count(*) || ' already-deployed assets.'
FROM `hardware`
WHERE `lifecycle_state` = 'Deployed' AND trim(`assigned_to`) NOT IN ('', 'Unassigned');
