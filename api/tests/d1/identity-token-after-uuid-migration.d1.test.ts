import { afterAll, beforeAll, expect, test } from "bun:test"
import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0342_convert_identity_ids_to_uuid.sql"

/** seed の E001 の Account。移行前の本番と同じ整数の ID へ戻してから migration を当てる。 */
const SEED_ACCOUNT_ID = "01900061-0000-7000-8000-000000000001"
const LEGACY_ACCOUNT_ID = "1"

const jwtSecret = "identity-token-after-uuid-migration-secret"
/** seed の password hash と一致する開発専用の pepper。 */
const pepper = "open-bedrock-local-seed-pepper"

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["identity-token-after-uuid-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

function bindings(database: D1Database): Bindings {
  return {
    DB: database,
    JWT_SECRET: jwtSecret,
    PEPPER_SECRET: pepper,
    AUDIT_HMAC_SECRET: "identity-token-after-uuid-migration-audit",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
  }
}

/** 移行前の Account ID も署名できるよう、ID の形を検査しない token の adapter で署名する。 */
async function signAccessToken(
  input: Readonly<{ accountId: string; tokenVersion: number; sessionFamilyId?: string }>,
): Promise<string> {
  const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
    input,
    jwtSecret,
    new Date(),
  )
  if (token instanceof Error) throw token
  return token
}

function currentProfile(database: D1Database, token: string): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/company/current-profile",
      { headers: { Authorization: `Bearer ${token}` } },
      bindings(database),
    ),
  )
}

function rotateSession(database: D1Database, refreshToken: string): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/system/sessions",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      bindings(database),
    ),
  )
}

/**
 * seed の Account の ID を、移行前の本番と同じ整数の文字列へ置き換える。
 * 全 table の TEXT 列に現れる Account の ID を1つの batch で書き換え、外部キーは batch の終わりに検査する。
 * 更新を拒む trigger は同じ batch の中で外し、書き換えの後に同じ定義で作り直す。
 */
async function rekeySeedAccountToLegacyId(database: D1Database): Promise<void> {
  const tables = await database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
    )
    .all<{ name: string }>()
  const triggers = await database
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'")
    .all<{ name: string; sql: string }>()
  const statements: string[] = ["PRAGMA defer_foreign_keys = true"]
  for (const trigger of triggers.results) statements.push(`DROP TRIGGER "${trigger.name}"`)
  for (const { name } of tables.results) {
    const columns = await database
      .prepare(`SELECT name, type FROM pragma_table_info('${name}')`)
      .all<{ name: string; type: string }>()
    const text = columns.results
      .filter((column) => column.type.toUpperCase() === "TEXT")
      .map((column) => `"${column.name}"`)
    // 同じ行の複数の列を1文で書き換え、列の間の CHECK を途中の状態で破らない。
    // 属性の JSON に埋めた ID も、移行前の製品が書いた形と同じく旧 ID へ置き換える。
    if (text.length > 0)
      statements.push(
        `UPDATE "${name}" SET ${text
          .map(
            (column) =>
              `${column} = replace(${column}, '${SEED_ACCOUNT_ID}', '${LEGACY_ACCOUNT_ID}')`,
          )
          .join(
            ", ",
          )} WHERE ${text.map((column) => `instr(${column}, '${SEED_ACCOUNT_ID}') > 0`).join(" OR ")}`,
      )
  }
  await database.batch([
    ...statements.map((statement) => database.prepare(statement)),
    ...triggers.results.map((trigger) => database.prepare(trigger.sql)),
  ])
}

test("0342 より前に発行した access token は移行後に 500 ではなく 401 で拒否し、新しい ID の token と移行前の refresh token は同じ本人として通す", async () => {
  const database = await local.database("identity-token-after-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  await rekeySeedAccountToLegacyId(database)

  // 移行前に発行済みだった session を置く。移行前の製品が書いた行と同じく、旧 ID の Account を指す。
  const material = new SystemSessionMaterialService()
  const refreshToken = material.generateRawToken()
  if (refreshToken instanceof Error) throw refreshToken
  const tokenHash = await material.hashRawToken(refreshToken)
  if (tokenHash instanceof Error) throw tokenHash
  const familyId = crypto.randomUUID()
  const issuedAt = Date.now()
  const legacyAccount = await database
    .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
    .bind(LEGACY_ACCOUNT_ID)
    .first<{ token_version: number }>()
  const tokenVersion = legacyAccount?.token_version ?? 0
  await database
    .prepare(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version, created_at, expires_at, authenticated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      LEGACY_ACCOUNT_ID,
      familyId,
      tokenHash,
      tokenVersion,
      issuedAt,
      issuedAt + 604_800_000,
    )
    .run()
  const legacyTokens = [
    await signAccessToken({ accountId: LEGACY_ACCOUNT_ID, tokenVersion }),
    await signAccessToken({
      accountId: LEGACY_ACCOUNT_ID,
      tokenVersion,
      sessionFamilyId: familyId,
    }),
  ]
  const person = await database
    .prepare(
      `SELECT e.employee_code AS code, e.email FROM company_account_employee_links l
       JOIN company_employees e ON e.id = l.employee_id WHERE l.account_id = ?1`,
    )
    .bind(LEGACY_ACCOUNT_ID)
    .first<{ code: string; email: string }>()
  expect(person).toEqual({ code: "E001", email: "you+e001@example.com" })

  await applyLocalD1Migration(database, TARGET)

  // 移行後、旧 ID を sub に持つ token は存在しない Account を指すため、認証で拒否する。
  for (const token of legacyTokens) {
    const response = await currentProfile(database, token)
    expect({
      status: response.status,
      contentType: response.headers.get("Content-Type"),
      body: await response.json(),
    }).toEqual({
      status: 401,
      contentType: "application/json",
      body: { error: "invalid token" },
    })
  }

  const migrated = await database
    .prepare("SELECT id, token_version FROM system_accounts WHERE legacy_id = ?1")
    .bind(LEGACY_ACCOUNT_ID)
    .first<{ id: string; token_version: number }>()
  expect(migrated?.id).not.toBe(LEGACY_ACCOUNT_ID)
  const migratedAccountId = migrated?.id ?? ""
  const migratedTokenVersion = migrated?.token_version ?? 0

  // 同じ人の新しい ID で発行した token は通り、移行前と同じ本人を返す。
  const after = await currentProfile(
    database,
    await signAccessToken({ accountId: migratedAccountId, tokenVersion: migratedTokenVersion }),
  )
  expect({ status: after.status, body: await after.json() }).toMatchObject({
    status: 200,
    body: { code: person?.code, email: person?.email },
  })

  // 移行は session を新しい Account ID へ付け替えて残す。移行前の refresh token は同じ人の新しい ID で回る。
  const refreshed = await rotateSession(database, refreshToken)
  const rotated = (await refreshed.json()) as { account_id: string; access_token: string }
  expect({ status: refreshed.status, accountId: rotated.account_id }).toEqual({
    status: 200,
    accountId: migratedAccountId,
  })
  const rotatedProfile = await currentProfile(database, rotated.access_token)
  expect({ status: rotatedProfile.status, body: await rotatedProfile.json() }).toMatchObject({
    status: 200,
    body: { code: person?.code, email: person?.email },
  })

  // 回した後の古い refresh token と、存在しない session の refresh token は 500 ではなく 401 で拒否する。
  for (const staleRefreshToken of [refreshToken, "f".repeat(64)]) {
    const stale = await rotateSession(database, staleRefreshToken)
    expect({
      status: stale.status,
      contentType: stale.headers.get("Content-Type"),
      body: await stale.json(),
    }).toEqual({
      status: 401,
      contentType: "application/json",
      body: { code: "invalid_session", error: "invalid session" },
    })
  }

  // 消えた session family を sid に持つ新しい ID の token も 500 ではなく 401 で拒否する。
  const orphan = await currentProfile(
    database,
    await signAccessToken({
      accountId: migratedAccountId,
      tokenVersion: migratedTokenVersion,
      sessionFamilyId: crypto.randomUUID(),
    }),
  )
  expect({ status: orphan.status, body: await orphan.json() }).toEqual({
    status: 401,
    body: { error: "invalid token" },
  })

  // 同じ人は password で login し直せば、新しい ID の session を得る。
  const relogin = await app.request(
    "/system/sessions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "you+e001@example.com", password: "password" }),
    },
    bindings(database),
  )
  expect({ status: relogin.status, body: await relogin.json() }).toMatchObject({
    status: 201,
    body: { account_id: migrated?.id },
  })
}, 300_000)
