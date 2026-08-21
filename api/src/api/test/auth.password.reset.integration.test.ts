import { app } from "@/api/app"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"
import {
  seedPasswordHash,
  seedPepperSecret,
} from "@/api/test/support/company/seed-password-hash.repository"
import { verifyPassword } from "@system/infrastructure/auth/verify-password.repository"
import { hashPasswordResetToken } from "@system/infrastructure/auth/hash-password-reset-token.repository"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

describe("System password reset HTTP", () => {
  test("raw tokenを保存せず、credential変更・全Session失効・challenge単回利用を不可分にする", async () => {
    const database = createD1TestDatabase(loadSchema())
    await seedD1(
      database,
      "employees",
      seedEmployees.map((employee) => ({
        id: employee.id,
        code: employee.code,
        name: employee.name,
        dept_id: employee.deptId,
        dept_name: employee.deptName,
        position: employee.position,
        status: employee.status,
      })),
    )
    await seedIamForEmployees(database)
    await database
      .prepare(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at,
            rotated_at, revoked_at)
         VALUES ('existing-session', '1', 'existing-family', ?1, 0, ?2, ?3, NULL, NULL)`,
      )
      .bind(
        "a".repeat(64),
        Date.parse("2025-12-31T00:00:00.000Z"),
        Date.parse("2026-02-01T00:00:00.000Z"),
      )
      .run()

    let emailText = ""
    const bindings = {
      DB: database,
      JWT_SECRET: "password-reset-test-jwt-secret",
      PEPPER_SECRET: seedPepperSecret,
      AUDIT_HMAC_SECRET: "password-reset-test-audit-secret",
      COMPANY_TIME_ZONE: "Asia/Tokyo",
      NOW: "2026-01-01T00:00:00.000Z",
      ENABLED_OPT_IN_APPS: "all",
      INVITE_EMAIL_SEND_ENABLED: "true",
      INVITE_EMAIL_FROM: "system@example.test",
      EMAIL_SENDER_NAME: "System",
      EMAIL: {
        async send(message: { text?: string }): Promise<void> {
          emailText = message.text ?? ""
        },
      },
    }
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, bindings)
    const client = hc<typeof app>("http://system.test", { fetch: request })
    const requested = await client.auth.password.reset.$post({
      json: { email: "you+e001@example.com" },
    })
    expect(requested.status).toBe(200)

    const rawToken = emailText.match(/token=([a-f0-9]{64})/u)?.[1]
    expect(rawToken).toBeDefined()
    if (rawToken === undefined) throw new Error("password reset email did not contain a token")
    const tokenHash = await hashPasswordResetToken(rawToken)
    if (tokenHash instanceof Error) throw tokenHash
    const storedChallenge = await database
      .prepare(
        `SELECT token_hash, used_at FROM system_password_reset_challenges
         WHERE account_id = '1'`,
      )
      .first<{ token_hash: string; used_at: number | null }>()
    expect(storedChallenge).toEqual({ token_hash: tokenHash, used_at: null })
    expect(storedChallenge?.token_hash).not.toBe(rawToken)

    const completed = await client.auth.password.reset.$patch({
      json: { token: rawToken, new_password: "new-password-value" },
    })
    expect(completed.status).toBe(200)
    const credential = await database
      .prepare(
        `SELECT password_hash FROM system_password_credentials WHERE identity_id = 'password:1'`,
      )
      .first<string>("password_hash")
    expect(credential).not.toBe(seedPasswordHash)
    expect(
      credential === null
        ? false
        : await verifyPassword("new-password-value", credential, seedPepperSecret),
    ).toBe(true)
    expect(
      await database
        .prepare("SELECT token_version FROM system_accounts WHERE id = '1'")
        .first<number>("token_version"),
    ).toBe(1)
    expect(
      await database
        .prepare("SELECT revoked_at FROM system_sessions WHERE id = 'existing-session'")
        .first<number>("revoked_at"),
    ).toBe(Date.parse("2026-01-01T00:00:00.000Z"))
    expect(
      await database
        .prepare("SELECT used_at FROM system_password_reset_challenges WHERE account_id = '1'")
        .first<number>("used_at"),
    ).toBe(Date.parse("2026-01-01T00:00:00.000Z"))

    const replayed = await client.auth.password.reset.$patch({
      json: { token: rawToken, new_password: "another-password" },
    })
    expect(replayed.status).toBe(400)

    const unknownRecipient = await client.auth.password.reset.$post({
      json: { email: "unknown@example.com" },
    })
    expect(unknownRecipient.status).toBe(200)

    emailText = ""
    const secondRequest = await client.auth.password.reset.$post({
      json: { email: "you+e001@example.com" },
    })
    expect(secondRequest.status).toBe(200)
    const secondRawToken = emailText.match(/token=([a-f0-9]{64})/u)?.[1]
    expect(secondRawToken).toBeDefined()
    if (secondRawToken === undefined)
      throw new Error("password reset email did not contain a token")

    const concurrentCompletions = await Promise.all([
      client.auth.password.reset.$patch({
        json: { token: secondRawToken, new_password: "concurrent-password" },
      }),
      client.auth.password.reset.$patch({
        json: { token: secondRawToken, new_password: "concurrent-password" },
      }),
    ])
    expect(
      concurrentCompletions.map((response) => response.status).sort((left, right) => left - right),
    ).toEqual([200, 400])
    expect(
      await database
        .prepare("SELECT token_version FROM system_accounts WHERE id = '1'")
        .first<number>("token_version"),
    ).toBe(2)
    expect(
      await database
        .prepare(
          `SELECT count(*) AS count FROM system_audit_events
           WHERE action IN ('auth.password_reset.requested', 'auth.password_reset.completed')`,
        )
        .first<number>("count"),
    ).toBe(4)
  })
})
