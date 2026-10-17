import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to connect to MySQL.");
}

const globalForDatabase = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
};

const pool =
  globalForDatabase.mysqlPool ??
  mysql.createPool(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.mysqlPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
