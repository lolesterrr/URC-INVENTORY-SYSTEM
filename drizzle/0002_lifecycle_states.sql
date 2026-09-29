-- Hardware lifecycle states. The old free-text `status` held condition notes ("OK", "Faulty", "To be disposed"…),
-- so lifecycle words become a state and any other text is kept as the condition note. Keep in sync with
-- legacyStatusToLifecycle() in server/services/lifecycle.ts.
ALTER TABLE `hardware` ADD `lifecycle_state` text DEFAULT 'In Stock' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hardware` ADD `lifecycle_changed_at` text;
--> statement-breakpoint
ALTER TABLE `hardware` ADD `condition` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `hardware` SET
  `lifecycle_state` = CASE lower(trim(`status`))
    WHEN 'in stock' THEN 'In Stock'
    WHEN 'in use' THEN 'Deployed'
    WHEN 'deployed' THEN 'Deployed'
    WHEN 'maintenance' THEN 'In Repair'
    WHEN 'in repair' THEN 'In Repair'
    WHEN 'retired' THEN 'Retired'
    WHEN 'disposed' THEN 'Disposed'
    ELSE CASE WHEN trim(`assigned_to`) NOT IN ('', 'Unassigned') THEN 'Deployed' ELSE 'In Stock' END
  END,
  `condition` = CASE
    WHEN lower(trim(`status`)) IN ('in stock', 'in use', 'deployed', 'maintenance', 'in repair', 'retired', 'disposed') THEN ''
    ELSE trim(`status`)
  END;
--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `status`;
--> statement-breakpoint
CREATE INDEX `hardware_lifecycle_idx` ON `hardware` (`lifecycle_state`);
--> statement-breakpoint
INSERT INTO `audit_log` (`username`, `role`, `action`, `details`)
SELECT 'system', 'system', 'Migrate Lifecycle',
  'Hardware status split into lifecycle state and condition note for ' || count(*) || ' records. The old status text is kept as the condition.'
FROM `hardware`;
