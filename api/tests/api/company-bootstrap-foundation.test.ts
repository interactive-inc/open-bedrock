import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

test("実APIでSystem初期化・ログインからCompany初期化・公開プロフィール・再送まで接続する", async () => {
  const database = createCompanyD1TestDatabase(schemaSql)
  const environment = {
    db: database,
    jwtSecret: "company-bootstrap-composition-jwt",
    bootstrapToken: "company-bootstrap-composition-token",
    now: new Date().toISOString(),
  }
  const declaration = {
    name: "First Member",
    code: "FIRST-001",
    organization_name: "Example Company",
    representative_name: "Confirmed Representative",
    initial_responsibilities: [],
    employment_type: "PART_TIME",
    hire_date: "2026-01-01",
    locale: "ja-JP",
    time_zone: "Asia/Tokyo",
    fiscal_year_start_month: 4,
    reason: "Confirmed initial company facts",
  }
  const company = (token: string | null) =>
    requestWithContext({
      ...environment,
      path: "/company/bootstrap",
      method: "POST",
      token,
      headers: { "idempotency-key": "bootstrap:composition" },
      body: declaration,
    })
  expect((await company(null)).status).toBe(401)
  const initialized = await requestWithContext({
    ...environment,
    path: "/system/bootstrap",
    method: "POST",
    token: null,
    body: {
      token: environment.bootstrapToken,
      email: "root@example.com",
      password: "bootstrap-composition-test-password",
    },
  })
  expect(initialized.status).toBe(201)
  const session = await requestWithContext({
    ...environment,
    path: "/system/sessions",
    method: "POST",
    token: null,
    body: { subject: "root@example.com", password: "bootstrap-composition-test-password" },
  })
  expect(session.status).toBe(201)
  const token = z.object({ access_token: z.string() }).parse(await session.json()).access_token
  await database.exec("UPDATE system_role_bindings SET revoked_at = created_at")
  expect((await company(token)).status).toBe(403)
  expect(
    await database
      .prepare("SELECT count(*) AS total FROM company_employees")
      .first<number>("total"),
  ).toBe(0)
  await database.exec(`INSERT INTO system_role_bindings
    (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
    SELECT 'bootstrap-test:renewed-binding', account_id, role_id, resource_type, resource_id, created_at, NULL
    FROM system_role_bindings`)
  const created = await company(token)
  expect(created.status).toBe(201)
  const saved = z
    .object({
      employee_id: z.string(),
      account_id: z.string(),
      organization_revision: z.number(),
      replayed: z.boolean(),
    })
    .parse(await created.json())
  expect(saved).toMatchObject({ organization_revision: 3, replayed: false })
  const profile = await requestWithContext({
    ...environment,
    path: "/company/profile",
    token,
    headers: { "x-company-organization-id": "organization:default" },
  })
  expect(profile.status).toBe(200)
  expect(await profile.json()).toMatchObject({
    resources: [
      {
        attributes: {
          displayName: declaration.organization_name,
          representativeName: declaration.representative_name,
        },
      },
    ],
  })
  const replay = await company(token)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual({ ...saved, replayed: true })
  await database.exec("UPDATE system_role_bindings SET revoked_at = created_at")
  expect((await company(token)).status).toBe(403)
  expect(
    await database
      .prepare("SELECT count(*) AS total FROM company_bootstrap_receipts")
      .first<number>("total"),
  ).toBe(1)
  await database.exec("UPDATE system_accounts SET token_version = token_version + 1")
  expect((await company(token)).status).toBe(401)
})
