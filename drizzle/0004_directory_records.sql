-- Departments, locations and staff become real records. Every distinct non-empty text value
-- (trimmed, compared case-insensitively) becomes one record; nothing is guessed or merged, and an
-- empty value stays empty. Locations start flat; an Admin nests them afterwards.
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `locations_parent_idx` ON `locations` (`parent_id`);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`staff_number` text DEFAULT '' NOT NULL,
	`department_id` integer,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `staff_department_idx` ON `staff` (`department_id`);
--> statement-breakpoint
INSERT INTO `departments` (`name`)
SELECT min(trim(`v`)) FROM (SELECT `department` AS `v` FROM `hardware` UNION ALL SELECT `department` FROM `software`)
WHERE trim(`v`) <> '' GROUP BY lower(trim(`v`)) ORDER BY 1;
--> statement-breakpoint
INSERT INTO `locations` (`name`)
SELECT min(trim(`location`)) FROM `hardware`
WHERE trim(`location`) <> '' GROUP BY lower(trim(`location`)) ORDER BY 1;
--> statement-breakpoint
-- Staff come from current assignees and past check-outs. "Unassigned" was a placeholder, not a person.
INSERT INTO `staff` (`full_name`)
SELECT min(trim(`v`)) FROM (SELECT `assigned_to` AS `v` FROM `hardware` UNION ALL SELECT `assignee` FROM `asset_assignments`)
WHERE trim(`v`) <> '' AND lower(trim(`v`)) <> 'unassigned' GROUP BY lower(trim(`v`)) ORDER BY 1;
--> statement-breakpoint
-- A staff member takes the department of an asset they hold (or held), if it has one.
UPDATE `staff` SET `department_id` = coalesce(
  (SELECT min(`d`.`id`) FROM `hardware` `h` JOIN `departments` `d` ON lower(`d`.`name`) = lower(trim(`h`.`department`))
   WHERE lower(trim(`h`.`assigned_to`)) = lower(`staff`.`full_name`)),
  (SELECT min(`d`.`id`) FROM `asset_assignments` `a` JOIN `hardware` `h` ON `h`.`id` = `a`.`hardware_id`
   JOIN `departments` `d` ON lower(`d`.`name`) = lower(trim(`h`.`department`))
   WHERE lower(trim(`a`.`assignee`)) = lower(`staff`.`full_name`))
);
--> statement-breakpoint
ALTER TABLE `hardware` ADD `department_id` integer REFERENCES departments(id);
--> statement-breakpoint
ALTER TABLE `hardware` ADD `location_id` integer REFERENCES locations(id);
--> statement-breakpoint
ALTER TABLE `hardware` ADD `assignee_id` integer REFERENCES staff(id);
--> statement-breakpoint
UPDATE `hardware` SET
  `department_id` = (SELECT `id` FROM `departments` WHERE lower(`name`) = lower(trim(`hardware`.`department`))),
  `location_id` = (SELECT `id` FROM `locations` WHERE lower(`name`) = lower(trim(`hardware`.`location`))),
  `assignee_id` = (SELECT `id` FROM `staff` WHERE lower(`full_name`) = lower(trim(`hardware`.`assigned_to`)));
--> statement-breakpoint
ALTER TABLE `asset_assignments` ADD `staff_id` integer REFERENCES staff(id);
--> statement-breakpoint
UPDATE `asset_assignments` SET `staff_id` = (SELECT `id` FROM `staff` WHERE lower(`full_name`) = lower(trim(`asset_assignments`.`assignee`)));
--> statement-breakpoint
-- A Deployed asset always has an open check-out, and one sent for repair while assigned keeps it (T9b).
-- Give every assigned asset in those states that has none the open row it should have. This covers assets
-- that were In Repair before check-out existed, and assets added by `npm run import-json` after migration
-- 0003 had already run (the import did not open check-outs before this release).
INSERT INTO `asset_assignments` (`hardware_id`, `staff_id`, `assignee`, `checked_out_at`, `checked_out_by`, `notes`)
SELECT `h`.`id`, `h`.`assignee_id`, `s`.`full_name`, coalesce(`h`.`lifecycle_changed_at`, `h`.`created_at`), 'system', 'Backfilled when staff records were introduced.'
FROM `hardware` `h` JOIN `staff` `s` ON `s`.`id` = `h`.`assignee_id`
WHERE `h`.`lifecycle_state` IN ('Deployed', 'In Repair')
  AND NOT EXISTS (SELECT 1 FROM `asset_assignments` `a` WHERE `a`.`hardware_id` = `h`.`id` AND `a`.`checked_in_at` IS NULL);
--> statement-breakpoint
ALTER TABLE `software` ADD `department_id` integer REFERENCES departments(id);
--> statement-breakpoint
UPDATE `software` SET `department_id` = (SELECT `id` FROM `departments` WHERE lower(`name`) = lower(trim(`software`.`department`)));
--> statement-breakpoint
DROP INDEX `hardware_department_idx`;
--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `department`;
--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `location`;
--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `assigned_to`;
--> statement-breakpoint
ALTER TABLE `software` DROP COLUMN `department`;
--> statement-breakpoint
CREATE INDEX `hardware_department_idx` ON `hardware` (`department_id`);
--> statement-breakpoint
CREATE INDEX `hardware_location_idx` ON `hardware` (`location_id`);
--> statement-breakpoint
CREATE INDEX `hardware_assignee_idx` ON `hardware` (`assignee_id`);
--> statement-breakpoint
INSERT INTO `audit_log` (`username`, `role`, `action`, `details`)
SELECT 'system', 'system', 'Migrate Directory',
  'Created ' || (SELECT count(*) FROM `departments`) || ' departments, ' || (SELECT count(*) FROM `locations`) ||
  ' locations and ' || (SELECT count(*) FROM `staff`) || ' staff records from the existing text fields.';
