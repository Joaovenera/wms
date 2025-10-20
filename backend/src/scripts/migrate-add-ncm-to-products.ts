import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm VARCHAR`);
    console.log("Migration completed: ncm column added to products (if not exists)");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();





