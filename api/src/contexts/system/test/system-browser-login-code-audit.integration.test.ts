import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ConsumeSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-browser-login-code.adapter"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const accountId = zAccountId.parse("account-browser")
const codeHash = "a".repeat(64)
const createdAt = new Date(1_000)
const expiresAt = new Date(61_000)

async function createDatabase(): Promise<D1Database> {
  const database = createSystemD1TestDatabase(
    readFileSync(new URL("../infrastructure/schema/system-core.sql", import.meta.url), "utf8"),
  )
  await database.exec(
    `INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('account-browser', 'active', 0, NULL, 1, 1);`,
  )
  return database
}

async function readAudits(database: D1Database) {
  const rows = await database
    .prepare(
      `SELECT actor_account_id, action, target_type, target_id, outcome, occurred_at
       FROM system_audit_events
       ORDER BY occurred_at, rowid`,
    )
    .all()
  return rows.results
}

describe("System browser login code audit", () => {
  test("発行と一度だけの消費を同じbatchの監査として記録する", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        accountId,
        createdAt,
        expiresAt,
      }),
    ).toBeNull()
    const consumer = new ConsumeSystemBrowserLoginCodeAdapter(context)
    expect(await consumer.consumeSystemBrowserLoginCode(codeHash, new Date(2_000))).toEqual({
      accountId,
    })
    expect(await consumer.consumeSystemBrowserLoginCode(codeHash, new Date(3_000))).toBeNull()

    expect(await readAudits(database)).toEqual([
      {
        actor_account_id: "account-browser",
        action: "auth.browser_login_code.created",
        target_type: "account",
        target_id: "account-browser",
        outcome: "succeeded",
        occurred_at: 1_000,
      },
      {
        actor_account_id: "account-browser",
        action: "auth.browser_login_code.consumed",
        target_type: "account",
        target_id: "account-browser",
        outcome: "succeeded",
        occurred_at: 2_000,
      },
    ])
  })

  test("失効済みcodeは消費も監査もしない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
      codeHash,
      accountId,
      createdAt,
      expiresAt,
    })

    expect(
      await new ConsumeSystemBrowserLoginCodeAdapter(context).consumeSystemBrowserLoginCode(
        codeHash,
        expiresAt,
      ),
    ).toBeNull()
    expect(await readAudits(database)).toHaveLength(1)
  })

  test("監査を記録できないときはcodeの発行も消費も確定しない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await database.exec(
      `INSERT INTO system_browser_login_codes (code_hash, account_id, created_at, expires_at) VALUES ('${"b".repeat(64)}', 'account-browser', 1000, 61000);`,
    )
    await database.exec("DROP TABLE system_audit_events;")

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        accountId,
        createdAt,
        expiresAt,
      }),
    ).toBeInstanceOf(Error)
    expect(
      await new ConsumeSystemBrowserLoginCodeAdapter(context).consumeSystemBrowserLoginCode(
        "b".repeat(64),
        new Date(2_000),
      ),
    ).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT code_hash FROM system_browser_login_codes ORDER BY code_hash")
        .all(),
    ).toMatchObject({ results: [{ code_hash: "b".repeat(64) }] })
  })
})
