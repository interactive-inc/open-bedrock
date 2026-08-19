import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyCompanyMigration } from "@/api/test/support/verify-company-migration"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/contexts/company/infrastructure/seed/seed-org-memberships"
import { z } from "zod"

const jwtSecret = "auth-me-route-test-secret"

const meResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
})

async function createTestDb(verified = true): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
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

  await seedIamForEmployees(db)
  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
  )
  await seedD1(
    db,
    "org_departments",
    seedOrgDepartments.map((department) => ({
      code: department.code,
      department_id: department.departmentId,
      parent_code: department.parentCode,
      manager_employee_code: department.managerEmployeeCode,
      sort_order: department.order,
    })),
  )
  await seedD1(
    db,
    "org_memberships",
    seedOrgMemberships.map((membership) => ({
      department_code: membership.departmentCode,
      employee_code: membership.employeeCode,
      manager_employee_code: membership.managerEmployeeCode,
    })),
  )
  if (verified) await verifyCompanyMigration(db)

  return db
}

async function getMe(token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path: "/me", token })
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "root",
  })
}

describe("GET /me", () => {
  test("returns 200 and the employee in CLI whoami shape", async () => {
    const response = await getMe(await adminToken())

    expect(response.status).toBe(200)

    const parsed = meResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.code).toBe("E001")
      expect(parsed.data.email).toBe("you+e001@example.com")
      expect(parsed.data.role).toBe("root")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getMe(null)

    expect(response.status).toBe(401)
  })

  test("returns 401 for an invalid token", async () => {
    const response = await getMe("not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 401 for an expired token", async () => {
    const expiredToken = await createTestToken(
      jwtSecret,
      { employeeId: 1, email: "you+e001@example.com", role: "root" },
      // 1 秒前に切れる exp（絶対 epoch 秒）。
      { expirationTime: Math.floor(Date.now() / 1000) - 1 },
    )

    const response = await getMe(expiredToken)

    expect(response.status).toBe(401)
  })

  test("returns 401 when the token employee does not exist", async () => {
    const token = await createTestToken(jwtSecret, {
      employeeId: 9999,
      email: "you+ghost@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(401)
  })

  test("returns 401 for a retired employee with a valid token (#775)", async () => {
    // E018 は seed 上 retired。退職者の既存トークンは即時無効化する。
    const token = await createTestToken(jwtSecret, {
      employeeId: 18,
      email: "you+e018@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(401)
  })

  test("returns 200 for a leave employee with a valid token (#775, leave は現状許可)", async () => {
    // E017 は seed 上 leave。休職中の API 利用は現仕様で許可。
    const token = await createTestToken(jwtSecret, {
      employeeId: 17,
      email: "you+e017@example.com",
      role: "member",
    })

    const response = await getMe(token)

    expect(response.status).toBe(200)
  })

  test("resolves email for an account whose only identity is external (oidc, no password)", async () => {
    // 外部 IdP 専用アカウント（password identity を持たない）でも email を返す。
    // provider="password" 決め打ちで解決していた頃は email が "" になっていた。
    const db = await createTestDb()

    await db
      .prepare(
        "DELETE FROM system_identity_bindings WHERE account_id = ?1 AND provider = 'password'",
      )
      .bind("1")
      .run()

    await db.batch([
      db
        .prepare(
          `INSERT INTO system_identity_bindings
             (id, account_id, provider, subject, created_at, activated_at, revoked_at)
           VALUES ('test:oidc:e001', ?1, 'oidc', 'external-subject-e001', 0, 0, NULL)`,
        )
        .bind("1"),
      db
        .prepare(
          `INSERT INTO system_identity_profiles
             (identity_id, email, email_verified, last_used_at, updated_at)
           VALUES ('test:oidc:e001', ?1, 1, NULL, 0)`,
        )
        .bind("you+e001@example.com"),
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({ email: "you+e001@example.com" }),
    )
  })

  test("prefers the password identity email when both password and oidc exist", async () => {
    // 複数 identity を持つアカウントでは password を優先し、結果を決定的にする。
    // oidc 側に小さい id を割り当て、自然な走査順では oidc が先に来る状態を作る。
    // これで ORDER BY を外すと落ちる（= 優先度指定が実際に SQL へ届いていることの検証になる）。
    const db = await createTestDb()

    await db.prepare("DELETE FROM system_identity_bindings WHERE account_id = '1'").run()

    await db.exec(`
      INSERT INTO system_identity_bindings
        (id, account_id, provider, subject, created_at, activated_at, revoked_at)
      VALUES
        ('test:oidc:e001', '1', 'oidc', 'ext-e001', 0, 0, NULL),
        ('test:password:e001', '1', 'password', 'you+e001@example.com', 0, 0, NULL);
      INSERT INTO system_identity_profiles
        (identity_id, email, email_verified, last_used_at, updated_at)
      VALUES
        ('test:oidc:e001', 'you+e001-external@example.com', 1, NULL, 0),
        ('test:password:e001', 'you+e001@example.com', 1, NULL, 0);
      INSERT INTO system_password_credentials
        (identity_id, password_hash, changed_at, created_at, updated_at)
      VALUES
        ('test:password:e001', 'password-hash-material', 0, 0, 0);
    `)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({ email: "you+e001@example.com" }),
    )
  })

  test("returns the effective lifecycle department and position after verification", async () => {
    const db = await createTestDb(false)
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (7, 'Sales');
      UPDATE org_departments SET department_id = 7 WHERE code = 'D004';
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('assignment-1', 1, 'employment-1', 1, 'D004', 'primary', 'Sales Director', NULL,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
      WHERE id = 1;
    `)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/me",
      token: await adminToken(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({ dept_name: "Sales", position: "Sales Director" }),
    )
  })
})
