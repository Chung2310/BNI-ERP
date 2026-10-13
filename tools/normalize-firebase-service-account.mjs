import { appendFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import process from "node:process";

const input = process.env.FIREBASE_SERVICE_ACCOUNT_INPUT?.trim();
if (!input) throw new Error("Firebase service-account credential is missing.");

let serviceAccount;
try {
  serviceAccount = JSON.parse(input);
} catch {
  try {
    serviceAccount = JSON.parse(Buffer.from(input, "base64").toString("utf8"));
  } catch {
    throw new Error("Firebase credential is neither raw JSON nor Base64-encoded JSON.");
  }
}

for (const field of ["project_id", "client_email", "private_key"]) {
  if (typeof serviceAccount[field] !== "string" || !serviceAccount[field].trim()) {
    throw new Error(`Firebase service account is missing ${field}.`);
  }
}

const normalized = Buffer.from(JSON.stringify(serviceAccount), "utf8").toString("base64");
process.stdout.write(`::add-mask::${normalized}\n`);
appendFileSync(process.env.GITHUB_ENV, `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=${normalized}\n`);
process.stdout.write(`Firebase credential normalized for project ${serviceAccount.project_id}.\n`);
