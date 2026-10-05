import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { LEGACY_USER_FIELDS } from "../utils/legacy-user-fields";

type UserCollection = Pick<mongoose.mongo.Collection, "countDocuments" | "updateMany">;

export async function removeLegacyUserFields(collection: UserCollection, options: { apply?: boolean; companyCode?: string } = {}) {
  const filter = {
    ...(options.companyCode ? { companyCode: options.companyCode.trim().toUpperCase() } : {}),
    $or: LEGACY_USER_FIELDS.map((field) => ({ [field]: { $exists: true } })),
  };
  const matched = await collection.countDocuments(filter);
  if (!options.apply || !matched) return { mode: options.apply ? "apply" : "preview", matched, modified: 0 };
  const result = await collection.updateMany(filter, {
    $unset: Object.fromEntries(LEGACY_USER_FIELDS.map((field) => [field, ""])),
  });
  return { mode: "apply", matched: result.matchedCount, modified: result.modifiedCount };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node --import tsx server/migrations/remove-legacy-user-fields.ts --database=<database> [--company=<code>] [--apply]");
    console.log("Defaults to read-only preview. Uses MONGODB_URI and optional MONGODB_USER/PASSWORD/AUTH_SOURCE. Back up the database before --apply.");
    return;
  }
  const database = args.find((arg) => arg.startsWith("--database="))?.slice(11).trim();
  const companyCode = args.find((arg) => arg.startsWith("--company="))?.slice(10).trim();
  if (!database || args.some((arg) => !arg.startsWith("--database=") && !arg.startsWith("--company=") && arg !== "--apply")) {
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
    const result = await removeLegacyUserFields(mongoose.connection.db!.collection("users"), {
      apply: args.includes("--apply"), companyCode,
    });
    console.log(JSON.stringify({ database, companyCode: companyCode || "all", ...result }));
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
