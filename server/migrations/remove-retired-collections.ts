import mongoose from "mongoose";
import { RETIRED_PERMISSION_CODES } from "../config/permission-catalog";
import { pathToFileURL } from "node:url";

export const RETIRED_COLLECTIONS = ["telegramlinktokens", "telegramsessions", "adminactions", "audit_events", "resourceimportruns", "domainevents", "hrleavetemplates", "hrleaveapplications", "timekeepinglogs", "timekeepingadjustmentaudits", "attendanceattempts", "faceenrollmentaudits"] as const;

type MigrationDatabase = Pick<mongoose.mongo.Db, "listCollections" | "collection" | "dropCollection">;
export async function removeRetiredCollections(db: MigrationDatabase, apply = false) {
  const existing = new Set((await db.listCollections({ name: { $in: [...RETIRED_COLLECTIONS] } }, { nameOnly: true }).toArray()).map((item) => item.name));
  const results = [];
  for (const name of RETIRED_COLLECTIONS) {
    const exists = existing.has(name);
    const documents = exists ? await db.collection(name).countDocuments({}) : 0;
    // Preserve nonempty business collections; only retired Telegram data was explicitly approved for deletion.
    const preserveHistory = !["telegramlinktokens", "telegramsessions"].includes(name) && documents > 0;
    if (apply && exists && !preserveHistory) await db.dropCollection(name);
    results.push({ name, exists, documents, dropped: apply && exists && !preserveHistory, preserveHistory });
  }
  return { mode: apply ? "apply" : "preview", collections: results };
}

export async function removeRetiredPermissions(db: Pick<mongoose.mongo.Db, "collection">, apply = false) {
  const codes = [...RETIRED_PERMISSION_CODES];
  const results = [];
  for (const name of ["users", "rolepermissions"]) {
    const collection = db.collection(name);
    const filter = { permissions: { $in: codes } };
    const matched = await collection.countDocuments(filter);
    const modified = apply && matched ? (await collection.updateMany(filter, { $pull: { permissions: { $in: codes } } } as any)).modifiedCount : 0;
    results.push({ name, matched, modified });
  }
  const catalog = db.collection("permissions");
  const filter = { code: { $in: codes } };
  const matched = await catalog.countDocuments(filter);
  const deleted = apply && matched ? (await catalog.deleteMany(filter)).deletedCount : 0;
  return { assignments: results, catalog: { matched, deleted } };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node --import tsx server/migrations/remove-retired-collections.ts --database=<database> [--apply]");
    console.log("Defaults to read-only preview. Uses MONGODB_URI and optional MONGODB_USER/PASSWORD/AUTH_SOURCE. Back up the database before --apply.");
    return;
  }
  const database = args.find((arg) => arg.startsWith("--database="))?.slice(11).trim();
  if (!database || args.some((arg) => !arg.startsWith("--database=") && arg !== "--apply")) {
    throw new Error("Specify --database=<database>; use --help for supported arguments.");
  }
  const { config } = await import("dotenv");
  config({ quiet: true });
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required; no default database is used.");
  const separateCredentials = process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && !uri.includes("@");
  try {
    await mongoose.connect(uri, {
      dbName: database, retryWrites: false, serverSelectionTimeoutMS: 10000,
      ...(separateCredentials ? { user: process.env.MONGODB_USER, pass: process.env.MONGODB_PASSWORD, authSource: process.env.MONGODB_AUTH_SOURCE || "admin" } : {}),
    });
    // Raw collection: avoid schema casting/defaults and startup seed side effects.
    const result = await removeRetiredCollections(mongoose.connection.db!, args.includes("--apply"));
    const permissions = await removeRetiredPermissions(mongoose.connection.db!, args.includes("--apply"));
    console.log(JSON.stringify({ database, ...result, permissions }));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Connection errors may contain credentials; do not echo them.
    console.error("Migration failed. Check arguments (--help), MongoDB connection and database permissions.");
    process.exitCode = 1;
  });
}
