import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("retired company admin activity route remains role-guarded and returns no history", () => {
  const source = fs.readFileSync("server/router/auth.router.ts", "utf8");
  const route = source.slice(source.indexOf('authRouter.get("/users/:id/activity"')).split("\n});")[0];
  assert.match(route, /requireAuth[\s\S]*requireRole\(\["admin"\]\)/);
  assert.match(route, /res\.json\(\{ items: \[\], total: 0 \}\)/);
  assert.doesNotMatch(route, /UserActivityEventModel/);
});
