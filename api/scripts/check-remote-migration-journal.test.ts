import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

function check(props: {
  responses: Record<string, unknown>
  populated?: boolean
  second?: boolean
}) {
  const directory = mkdtempSync(join(tmpdir(), "migration-preflight-"))
  try {
    mkdirSync(join(directory, "bin"))
    mkdirSync(join(directory, "one"))
    mkdirSync(join(directory, "two"))
    writeFileSync(join(directory, "one", "0001_initial.sql"), "SELECT 1;")
    writeFileSync(join(directory, "two", "0002_other.sql"), "SELECT 1;")
    writeFileSync(
      join(directory, "config.jsonc"),
      `// JSONC and binding-local directories\n${JSON.stringify({ d1_databases: [{ binding: "DB", database_id: "example-one", migrations_dir: "one" }, ...(props.second ? [{ binding: "SECOND", database_id: "example-two", migrations_dir: "two" }] : [])] })}`,
    )
    writeFileSync(
      join(directory, "bin", "bunx"),
      `#!/usr/bin/env node
const args=process.argv.slice(2);
if(args[0]!=='wrangler'||args[1]!=='d1'||args[2]!=='execute'||!args.includes('--remote'))process.exit(20);
const plan=JSON.parse(process.env.PREFLIGHT_TEST_PLAN);
const query=args[args.indexOf('--command')+1];
if(query.includes('sqlite_master')){console.log(JSON.stringify([{success:true,results:process.env.PREFLIGHT_POPULATED==='true'?[{name:'existing_data'}]:[]}]));process.exit(0)}
const rows=plan[args[3]];
if(rows==='missing'){console.error('no such table: d1_migrations');process.exit(1)}
if(rows==='offline'){console.error('network unavailable');process.exit(1)}
console.log(JSON.stringify([{success:true,results:rows}]));
`,
      { mode: 0o755 },
    )
    return spawnSync(
      process.execPath,
      [
        join(import.meta.dir, "check-remote-migration-journal.ts"),
        "--config",
        join(directory, "config.jsonc"),
      ],
      {
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${join(directory, "bin")}:${process.env.PATH}`,
          PREFLIGHT_TEST_PLAN: JSON.stringify(props.responses),
          PREFLIGHT_POPULATED: String(props.populated ?? false),
        },
      },
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("CLI checks each configured binding using its own migration directory", () => {
  expect(
    check({
      second: true,
      responses: { DB: [{ name: "0001_initial.sql" }], SECOND: [{ name: "0002_other.sql" }] },
    }).status,
  ).toBe(0)
  const failure = check({
    second: true,
    responses: { DB: [{ name: "0001_initial.sql" }], SECOND: [{ name: "0009_removed.sql" }] },
  })
  expect(failure.status).not.toBe(0)
  expect(failure.stderr).toContain("SECOND: applied migration is missing locally")
})
test("missing journals are allowed only for empty databases", () => {
  expect(check({ responses: { DB: "missing" } }).status).toBe(0)
  const failure = check({ responses: { DB: "missing" }, populated: true })
  expect(failure.status).not.toBe(0)
  expect(failure.stderr).toContain("journal is missing or empty in a populated database")
})
test("network errors and malformed journal rows never pass", () => {
  expect(check({ responses: { DB: "offline" } }).status).not.toBe(0)
  expect(check({ responses: { DB: [{ unknown: "0001_initial.sql" }] } }).status).not.toBe(0)
})

test("an emptied journal does not turn existing application data into a fresh database", () => {
  expect(check({ responses: { DB: [] }, populated: true }).status).not.toBe(0)
  expect(check({ responses: { DB: [] } }).status).toBe(0)
})
