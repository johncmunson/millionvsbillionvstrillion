CREATE TABLE `net_worth_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_address` text NOT NULL,
	`window_date` text NOT NULL,
	`request_count` integer NOT NULL,
	`reset_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `net_worth_rate_limits_ip_window_date_unique` ON `net_worth_rate_limits` (`ip_address`,`window_date`);--> statement-breakpoint
CREATE INDEX `net_worth_rate_limits_reset_at_idx` ON `net_worth_rate_limits` (`reset_at`);