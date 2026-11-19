import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Altering DB...");
  await db.execute(sql`ALTER TABLE deberes ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES participantes(id) ON DELETE SET NULL;`);
  await db.execute(sql`ALTER TABLE deberes ADD COLUMN IF NOT EXISTS limite_por_persona boolean DEFAULT false NOT NULL;`);
  await db.execute(sql`ALTER TABLE deberes ADD COLUMN IF NOT EXISTS depende_de_deber_id uuid REFERENCES deberes(id) ON DELETE SET NULL;`);
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
