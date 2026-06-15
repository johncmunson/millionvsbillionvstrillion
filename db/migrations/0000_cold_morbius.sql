CREATE TABLE `net_worth_cache_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resolved_name` text NOT NULL,
	`estimated_net_worth` integer NOT NULL,
	`sources` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `net_worth_cache_entries_expires_at_idx` ON `net_worth_cache_entries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `net_worth_cache_lookup_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_entry_id` integer NOT NULL,
	`lookup_key` text NOT NULL,
	`display_value` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cache_entry_id`) REFERENCES `net_worth_cache_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `net_worth_cache_lookup_keys_lookup_key_unique` ON `net_worth_cache_lookup_keys` (`lookup_key`);--> statement-breakpoint
CREATE INDEX `net_worth_cache_lookup_keys_cache_entry_id_idx` ON `net_worth_cache_lookup_keys` (`cache_entry_id`);