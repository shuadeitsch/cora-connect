import "server-only";
import fs from "fs";
import path from "path";
import { buildSeed } from "@/lib/seed";
import type { Database } from "@/lib/types";

const filePath = path.join(process.cwd(), "data", "db.json");
const memory = globalThis as unknown as { __coraDb?: Database };

function readFile(): Database | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Database;
    if (!parsed || parsed.version !== 1 || !parsed.organization) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadDemo(): Database {
  const fromDisk = readFile();
  if (fromDisk) {
    memory.__coraDb = fromDisk;
    return fromDisk;
  }
  if (memory.__coraDb?.version === 1) return memory.__coraDb;
  const seeded = buildSeed(new Date());
  persistDemo(seeded);
  return seeded;
}

export function persistDemo(db: Database) {
  memory.__coraDb = db;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(db));
  } catch {
    // A read-only deploy keeps the database in memory for this process only.
  }
}

export function resetDemo(): Database {
  const seeded = buildSeed(new Date());
  persistDemo(seeded);
  return seeded;
}
