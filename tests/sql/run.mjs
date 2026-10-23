#!/usr/bin/env node
// SQL tests: supabase/setup.sql on PGlite. `npm run test:sql`.
import { failed } from "./harness.mjs";

const suites = ["seed", "rsvp", "wishes"];
for (const name of suites) {
  console.log(name);
  const { default: run } = await import(`./${name}.test.mjs`);
  try {
    await run();
  } catch (e) {
    console.log(`  FAIL ${name} crashed — ${e.message}`);
    process.exitCode = 1;
  }
}
const n = failed();
console.log(n ? `\n${n} check(s) failed` : "\nall SQL checks passed");
if (n) process.exitCode = 1;
