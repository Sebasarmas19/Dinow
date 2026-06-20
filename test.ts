import { db } from "./lib/db/index";
import { deberes } from "./lib/db/schema";
async function main() {
  const all = await db.select().from(deberes);
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}
main();
