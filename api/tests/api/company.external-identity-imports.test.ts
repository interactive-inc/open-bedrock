import { describe, expect, test } from "bun:test"
import {
  createExternalIdentityImportTestContext,
  EXTERNAL_IMPORT_TEST_SECRET,
} from "@/contexts/company/test/external-identity-import.test-support"
import type { ExternalIdentityImportInput } from "@/contexts/company/domain/entities/external-identity-import.entity"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

type Fixture = Awaited<ReturnType<typeof createExternalIdentityImportTestContext>>

function body(input: ExternalIdentityImportInput) {
  return {
    command_id: input.commandId,
    expected_revision: input.expectedRevision,
    reason: input.reason,
    identities: input.identities.map((identity) => ({
      subject: identity.subject,
      source_revision: identity.sourceRevision,
      email: identity.email,
      name: identity.name,
      account_id: identity.accountId,
      initial_role_id: identity.initialRoleId,
      new_employee:
        identity.newEmployee === null
          ? null
          : {
              hire_date: identity.newEmployee.hireDate,
              employment_type: identity.newEmployee.employmentType,
            },
    })),
  }
}
function post(c: Fixture, input: unknown = body(c.input), token: string | null = c.token) {
  return requestWithContext({
    db: c.database,
    jwtSecret: EXTERNAL_IMPORT_TEST_SECRET,
    path: "/company/external-identity-imports",
    token,
    method: "POST",
    body: input,
    now: c.clock.at.toISOString(),
  })
}

describe("POST /company/external-identity-imports", () => {
  test("機械認証の例外を別methodや隣のCompany入口へ広げない", async () => {
    const c = await createExternalIdentityImportTestContext()
    for (const path of ["/company/external-identity-imports", "/company/people"]) {
      const response = await requestWithContext({
        db: c.database,
        jwtSecret: EXTERNAL_IMPORT_TEST_SECRET,
        path,
        token: null,
        now: c.clock.at.toISOString(),
      })
      expect(response.status).toBe(401)
    }
    const write = await requestWithContext({
      db: c.database,
      jwtSecret: EXTERNAL_IMPORT_TEST_SECRET,
      path: "/company/people",
      token: c.token,
      method: "POST",
      body: {},
      now: c.clock.at.toISOString(),
    })
    expect(write.status).toBe(401)
  })
  test("機械sessionで登録し、公開Company APIから同じ氏名を読める", async () => {
    const c = await createExternalIdentityImportTestContext()
    const created = await post(c)
    expect({ status: created.status, body: await created.json() }).toMatchObject({
      status: 200,
      body: {
        created: 1,
        updated: 0,
        skipped: 0,
        organization_revision: c.input.expectedRevision + 1,
        replayed: false,
      },
    })
    const row = await c.database
      .prepare(
        "SELECT account_id FROM system_identity_bindings WHERE subject = 'external-person-1'",
      )
      .first<Record<string, unknown>>()
    const account = z.object({ account_id: zAccountId }).parse(row)
    const token = await new SystemAccessTokenIssuer(EXTERNAL_IMPORT_TEST_SECRET).issue({
      accountId: account.account_id,
      tokenVersion: 0,
      now: new Date(),
    })
    if (token instanceof Error) throw token
    const response = await requestWithContext({
      db: c.database,
      jwtSecret: EXTERNAL_IMPORT_TEST_SECRET,
      path: "/company/people?effective_on=2026-01-01",
      token,
      headers: { "x-company-organization-id": "organization:default" },
      now: c.clock.at.toISOString(),
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("Example Person")
    const replay = await post(c)
    expect(await replay.json()).toMatchObject({ created: 1, replayed: true })
  })

  test("更新・再送・順序逆転をHTTPの結果に反映する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await post(c)).status).toBe(200)
    const next = {
      ...c.input,
      commandId: "next",
      expectedRevision: c.input.expectedRevision + 1,
      identities: c.input.identities.map((identity) => ({
        ...identity,
        sourceRevision: 2,
        name: "Updated Person",
      })),
    }
    const updated = await post(c, body(next))
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      updated: 1,
      organization_revision: c.input.expectedRevision + 2,
    })
    expect(
      (
        await post(
          c,
          body({ ...c.input, commandId: "old", expectedRevision: c.input.expectedRevision + 2 }),
        )
      ).status,
    ).toBe(409)
  })

  test("一括登録を一つのCompany版で保存する", async () => {
    const c = await createExternalIdentityImportTestContext()
    const first = c.input.identities[0]
    if (first === undefined) throw new Error("fixture identity missing")
    const response = await post(
      c,
      body({
        ...c.input,
        identities: [first, { ...first, subject: "external-2", email: "second@example.com" }],
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      created: 2,
      organization_revision: c.input.expectedRevision + 1,
    })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 8 })
  })

  test("旧共有キー・未認証・人のtokenで機械同期を実行できない", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await post(c, body(c.input), "old-shared-provisioning-key")).status).toBe(401)
    expect((await post(c, body(c.input), null)).status).toBe(401)
    await c.database.exec(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('human', 'active', 0, 0, 0)",
    )
    const token = await new SystemAccessTokenIssuer(EXTERNAL_IMPORT_TEST_SECRET).issue({
      accountId: zAccountId.parse("human"),
      tokenVersion: 0,
      now: new Date(),
    })
    if (token instanceof Error) throw token
    expect((await post(c, body(c.input), token)).status).toBe(403)
  })

  test("provider scope違いは403、credential失効後の再送は401になる", async () => {
    const other = await createExternalIdentityImportTestContext("other-provider")
    expect((await post(other)).status).toBe(403)
    const c = await createExternalIdentityImportTestContext()
    expect((await post(c)).status).toBe(200)
    await c.database.exec(
      "UPDATE system_machine_credentials SET status = 'revoked', revoked_at = updated_at",
    )
    expect((await post(c)).status).toBe(401)
  })

  test.each(["line\nbreak", "ユーザー", "a".repeat(256)])(
    "不正なsubjectを保存前に拒否する",
    async (subject) => {
      const c = await createExternalIdentityImportTestContext()
      const payload = body(c.input)
      const identity = payload.identities[0]
      if (identity === undefined) throw new Error("fixture identity missing")
      identity.subject = subject
      expect((await post(c, payload)).status).toBe(400)
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM company_employees")
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 0 })
    },
  )

  test("commandと雇用事実を持たない旧入力を400で拒否する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect(
      (await post(c, { subject: "old", email: "you@example.com", name: "Old input" })).status,
    ).toBe(400)
    const payload = body(c.input)
    const identity = payload.identities[0]
    if (identity === undefined) throw new Error("fixture identity missing")
    identity.new_employee = null
    expect((await post(c, payload)).status).toBe(400)
  })
})
