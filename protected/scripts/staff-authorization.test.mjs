import assert from "node:assert/strict";
import { test } from "node:test";
import { isPortalStaff } from "../src/lib/staff-authorization.ts";

test("staff authorization fails closed unless the database explicitly approves", async () => {
  for (const result of [
    { data: false, error: null },
    { data: null, error: null },
    { data: "true", error: null },
    { data: true, error: { message: "permission denied" } },
    { data: null, error: { message: "missing migration" } },
  ]) {
    assert.equal(await isPortalStaff({ rpc: async name => {
      assert.equal(name, "is_portal_staff");
      return result;
    } }), false);
  }
  assert.equal(await isPortalStaff({ rpc: async () => ({ data: true, error: null }) }), true);
});
