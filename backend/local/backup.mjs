import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function backupDatabase(sourcePath, destinationPath) {
  const source = resolve(sourcePath);
  const destination = resolve(destinationPath);
  if (!existsSync(source)) throw new Error("Source database does not exist.");
  if (existsSync(destination)) throw new Error("Backup destination already exists. Choose a new filename.");
  mkdirSync(dirname(destination), { recursive: true });
  const db = new DatabaseSync(source);
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("VACUUM INTO '" + destination.replace(/'/g, "''") + "'");
  } finally {
    db.close();
  }
  const check = new DatabaseSync(destination, { readOnly: true });
  try {
    const integrity = check.prepare("PRAGMA integrity_check").get();
    if (Object.values(integrity || {})[0] !== "ok") throw new Error("SQLite backup integrity check failed.");
  } finally {
    check.close();
  }
  return destination;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const source = process.env.MG_DATABASE_PATH || "./data/marketing-genius.sqlite";
  const destination = process.argv[2] || `./backups/marketing-genius-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;
  console.log("Backup created:", backupDatabase(source, destination));
}
