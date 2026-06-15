import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { NetWorthSource } from "../app/net-worth";

export const netWorthCacheEntries = sqliteTable(
  "net_worth_cache_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resolvedName: text("resolved_name").notNull(),
    estimatedNetWorth: integer("estimated_net_worth").notNull(),
    sources: text("sources", { mode: "json" })
      .$type<NetWorthSource[]>()
      .notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("net_worth_cache_entries_expires_at_idx").on(table.expiresAt)],
);

export const netWorthCacheLookupKeys = sqliteTable(
  "net_worth_cache_lookup_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cacheEntryId: integer("cache_entry_id")
      .notNull()
      .references(() => netWorthCacheEntries.id, { onDelete: "cascade" }),
    lookupKey: text("lookup_key").notNull(),
    displayValue: text("display_value").notNull(),
    kind: text("kind", { enum: ["name", "alias"] }).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("net_worth_cache_lookup_keys_lookup_key_unique").on(
      table.lookupKey,
    ),
    index("net_worth_cache_lookup_keys_cache_entry_id_idx").on(
      table.cacheEntryId,
    ),
  ],
);
