import fs from "fs";
import path from "path";
import { buildSeed } from "../lib/seed";
import { toSql } from "./to-sql";

const db = buildSeed(new Date());
if (process.argv.includes("--sql")) {
  const target = path.join(process.cwd(), "supabase", "seed_demo.sql");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, toSql(db));
  console.log(`Wrote ${target}`);
} else {
  const target = path.join(process.cwd(), "data", "db.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(db));
  console.log(`Wrote ${target} (${db.households.length} fictional households)`);
}
