CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`char_offset` integer NOT NULL,
	`label` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`title` text NOT NULL,
	`author` text,
	`source_uri` text NOT NULL,
	`content_uri` text NOT NULL,
	`cover_uri` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`page_count` integer,
	`chapter_count` integer DEFAULT 0 NOT NULL,
	`fk_grade` real,
	`cefr` text,
	`last_read_at` integer,
	`progress` real DEFAULT 0 NOT NULL,
	`current_chapter` integer DEFAULT 0 NOT NULL,
	`current_offset` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`note` text,
	`snippet` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vocab_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`word` text NOT NULL,
	`lemma` text NOT NULL,
	`book_id` text,
	`chapter_index` integer,
	`char_offset` integer,
	`sentence` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
