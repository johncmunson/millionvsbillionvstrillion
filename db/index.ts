import "server-only";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createDb() {
  const url = process.env.TURSO_DATABASE_URL;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not configured.");
  }

  return drizzle({
    client: createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    schema,
  });
}

type Db = ReturnType<typeof createDb>;

let dbInstance: Db | null = null;

export function getDb() {
  dbInstance ??= createDb();
  return dbInstance;
}

export const db = new Proxy({} as Db, {
  get(_target, property) {
    const database = getDb();
    const value = database[property as keyof Db];

    return typeof value === "function" ? value.bind(database) : value;
  },
});
