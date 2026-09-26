import { organizationProfileVersionSchema } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { execSql } from "@tests/d1/support/exec-sql"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["bootstrap"] })
})

afterAll(async () => {
  await local.dispose()
})

test("実APIでSystem初期化・ログインからCompany初期化・公開プロフィール・再送まで接続する", async () => {
  const database = await local.database("bootstrap")
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
  await execSql(database, "UPDATE system_role_bindings SET revoked_at = created_at")
  expect((await company(token)).status).toBe(403)
  expect(
    await database
      .prepare("SELECT count(*) AS total FROM company_employees")
      .first<number>("total"),
  ).toBe(0)
  await execSql(
    database,
    `INSERT INTO system_role_bindings
    (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
    SELECT '79ca132d-0acd-497b-8f78-3ef686197842', account_id, role_id, resource_type, resource_id, created_at, NULL
    FROM system_role_bindings`,
  )
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
    headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
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
  const shownResponse = await requestWithContext({
    ...environment,
    path: "/company/organization-profile",
    token,
  })
  expect(shownResponse.status).toBe(200)
  const shown = z
    .object({ version: organizationProfileVersionSchema })
    .parse(await shownResponse.json())
  const profileInput = {
    name: "Updated Company",
    representativeName: "Updated Representative",
    locale: "ja-JP",
    timeZone: "Asia/Tokyo",
    fiscalYearStartMonth: 4,
    version: shown.version,
    reason: "Confirmed company update",
  }
  const editProfile = (accessToken: string | null) =>
    requestWithContext({
      ...environment,
      path: "/company/organization-profile",
      method: "PUT",
      token: accessToken,
      headers: { "idempotency-key": "company-profile:composition" },
      body: profileInput,
    })
  expect((await editProfile(null)).status).toBe(401)
  expect((await editProfile(token)).status).toBe(200)
  const updatedProfile = await requestWithContext({
    ...environment,
    path: "/company/profile",
    token,
    headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
  })
  expect(updatedProfile.status).toBe(200)
  expect(await updatedProfile.json()).toMatchObject({
    organizationRevision: 4,
    resources: [
      {
        attributes: {
          displayName: "Updated Company",
          representativeName: "Updated Representative",
        },
      },
    ],
  })
  expect(await (await editProfile(token)).json()).toMatchObject({
    organizationRevision: 4,
    replayed: true,
  })
  await execSql(database, "UPDATE system_role_bindings SET revoked_at = created_at")
  expect((await company(token)).status).toBe(403)
  expect((await editProfile(token)).status).toBe(403)
  expect(
    await database
      .prepare("SELECT count(*) AS total FROM company_bootstrap_receipts")
      .first<number>("total"),
  ).toBe(1)
  await execSql(database, "UPDATE system_accounts SET token_version = token_version + 1")
  expect((await company(token)).status).toBe(401)
  expect((await editProfile(token)).status).toBe(401)
})
