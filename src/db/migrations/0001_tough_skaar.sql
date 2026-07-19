ALTER TABLE `vocab_entries` ADD `due_at` integer;--> statement-breakpoint
ALTER TABLE `vocab_entries` ADD `interval_days` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vocab_entries` ADD `ease_factor` real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `vocab_entries` ADD `review_count` integer DEFAULT 0 NOT NULL;