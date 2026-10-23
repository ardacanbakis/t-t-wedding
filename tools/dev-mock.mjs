#!/usr/bin/env node
// Try the whole site locally with no Supabase project: starts the in-memory
// mock (tools/mock-supabase.mjs) and `next dev` pointed at it.
//
//   npm run dev:mock     → http://localhost:3000
//                          admin: admin@example.com / test-pass-123
//                          guests: /i/?t=demo-accepted (also demo-pending, demo-declined)
//
// The seed's wedding is already over, so guest pages open in thank-you mode;
// set MOCK_OPEN_RSVP=1 to move the wedding a month ahead and get the RSVP form.

import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon",
  NEXT_PUBLIC_BASE_PATH: "",
};
const node = (args) => spawn(process.execPath, args, { env, stdio: "inherit" });

const mock = node(["tools/mock-supabase.mjs"]);
const config = node(["tools/write-story-config.mjs"]);
config.on("exit", (code) => {
  if (code) process.exit(code);
  const next = node(["node_modules/next/dist/bin/next", "dev"]);
  next.on("exit", (c) => {
    mock.kill();
    process.exit(c ?? 0);
  });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
});
mock.on("exit", (code) => code && console.error(`mock-supabase exited (${code}) — is port 54321 taken?`));
