-- Purchase and warranty details (T9d).
--
-- The legacy register recorded only a purchase YEAR, so `purchase_date` holds either a year ('2019')
-- or an exact date ('2019-03-14'). Both sort correctly as text, and no day is ever invented from a year.
ALTER TABLE `hardware` ADD `purchase_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hardware` ADD `purchase_cost` real;--> statement-breakpoint
ALTER TABLE `hardware` ADD `order_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hardware` ADD `supplier` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hardware` ADD `warranty_expires` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `hardware` ADD `warranty_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- The purchase year carries over as it stands. Anything that is not a four-digit year is left empty
-- rather than guessed at.
UPDATE `hardware` SET `purchase_date` = trim(`year_of_purchase`)
WHERE trim(`year_of_purchase`) GLOB '19[0-9][0-9]' OR trim(`year_of_purchase`) GLOB '20[0-9][0-9]';--> statement-breakpoint
-- `cost` was NOT NULL DEFAULT 0, so an asset nobody had priced looked exactly like a free one. Only a
-- figure above zero is a real cost; the rest become NULL, which the app shows as blank.
UPDATE `hardware` SET `purchase_cost` = `cost` WHERE `cost` > 0;--> statement-breakpoint
-- `date_acquired` is dropped WITHOUT being carried over. No form ever set it and nothing ever displayed
-- it: POST /api/hardware stamped every new asset with the date it was entered, which is an invented
-- value, not a purchase date.
ALTER TABLE `hardware` DROP COLUMN `year_of_purchase`;--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `date_acquired`;--> statement-breakpoint
ALTER TABLE `hardware` DROP COLUMN `cost`;--> statement-breakpoint
INSERT INTO `audit_log` (`username`, `role`, `action`, `details`)
SELECT 'system', 'system', 'Migrate Purchase Fields',
  'Added purchase and warranty fields. Carried over ' || (SELECT count(*) FROM `hardware` WHERE `purchase_date` <> '') ||
  ' purchase year(s) and ' || (SELECT count(*) FROM `hardware` WHERE `purchase_cost` IS NOT NULL) ||
  ' purchase cost(s). Dropped the unused "date acquired" column, which only ever held the date each asset was entered.';
