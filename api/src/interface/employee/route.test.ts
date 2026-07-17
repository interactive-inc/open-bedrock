import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedPositions } from "@/infrastructure/seed/seed-positions"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { z } from "zod"

const jwtSecret = "employee-route-test-secret"

const employeeResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string(),
  status: z.string(),
})

async function createTestDb(): Promise<D1Database> {
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

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /employees", () => {
  test("returns 200 with every employee in CLI response shape", async () => {
    const response = await request("/employees", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(14)

      const lead = parsed.data.data.find((employee) => employee.code === "E001")

      expect(lead?.name).toBe("Alex Carter")
      expect(lead?.dept_name).toBe("Corporate Planning")
      expect(lead?.position).toBe("CTO")
      expect(lead?.email).toBe("you+e001@example.com")
      expect(lead?.status).toBe("active")
    }
  })

  test("never leaks passwordHash id deptId deptName or role", async () => {
    const response = await request("/employees", await adminToken())

    const parsed = z
      .object({ data: z.array(z.record(z.string(), z.unknown())), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      for (const row of parsed.data.data) {
        expect("passwordHash" in row).toBe(false)
        expect("password_hash" in row).toBe(false)
        expect("id" in row).toBe(false)
        expect("deptId" in row).toBe(false)
        expect("deptName" in row).toBe(false)
        expect("role" in row).toBe(false)
      }
    }
  })

  test("filters by keyword via q", async () => {
    const response = await request("/employees?q=Drew", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E004")
    }
  })

  test("treats % as a literal so it cannot match every employee", async () => {
    const response = await request("/employees?q=%25", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("treats _ as a literal so it cannot match a single character", async () => {
    const response = await request("/employees?q=_", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
    }
  })

  test("filters by department name via dept", async () => {
    const response = await request("/employees?dept=Engineering", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("filters by status", async () => {
    const response = await request("/employees?status=active", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(12)
    }
  })

  test("filters by status leave", async () => {
    const response = await request("/employees?status=leave", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E017")
    }
  })

  test("filters by status retired", async () => {
    const response = await request("/employees?status=retired", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("E018")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/employees", null)

    expect(response.status).toBe(401)
  })

  test("returns 403 without employee:read", async () => {
    const response = await request("/employees", await memberToken())

    expect(response.status).toBe(403)
  })

  test("employee:read lists only self and managed employees without org:manage", async () => {
    const response = await request("/employees", await managerToken())

    expect(response.status).toBe(200)
    const body = z
      .object({ data: z.array(employeeResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(new Set(body.data.map((employee) => employee.code))).toEqual(new Set(["E004", "E005"]))
    expect(body.total).toBe(2)
  })

  test("returns 401 with an invalid bearer token", async () => {
    const response = await request("/employees", "not-a-real-token")

    expect(response.status).toBe(401)
  })

  test("returns 400 when status is outside the allowed set", async () => {
    const response = await request("/employees?status=unknown", await adminToken())

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unregistered path", async () => {
    const response = await request("/employees/extra", await adminToken())

    expect(response.status).toBe(404)
  })
})

describe("GET /directory/employees", () => {
  test("returns only active employees without sensitive fields to a member", async () => {
    const response = await request("/directory/employees", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(z.record(z.string(), z.unknown())), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(12)

      for (const employee of parsed.data.data) {
        expect("email" in employee).toBe(false)
        expect("status" in employee).toBe(false)
        expect("role" in employee).toBe(false)
        expect("id" in employee).toBe(false)
      }
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/directory/employees", null)

    expect(response.status).toBe(401)
  })

  test("uses current lifecycle state for visibility, department filters, and position", async () => {
    const db = await createTestDb()
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (4, 'Sales');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-5', 1, 5, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-6', 1, 6, '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-5', 1, 'employment-5', 5, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-6', 1, 'employment-6', 6, 'active', '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-5', 1, 'employment-5', 5, 'D004', 'primary', 'Account Lead', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-6', 1, 'employment-6', 6, 'D003', 'primary', 'Engineer', NULL, '2027-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/directory/employees?dept=Sales",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: [
        {
          code: "E005",
          name: "Emery Lane",
          dept_name: "Sales",
          position: "Account Lead",
        },
      ],
      total: 1,
    })
  })
})

// --- position master が存在するときの POST /employees 役職コード検証 ---

describe("POST /employees > position code validation", () => {
  // RegisterEmployee は employee:lifecycle:apply + verified lifecycle が必要。
  // admin の lifecycle 状態を verified にしてから検証する。
  async function enableVerifiedLifecycle(db: D1Database): Promise<void> {
    await db.exec(`
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('fixture-employment-e001', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('fixture-status-e001', 1, 'fixture-employment-e001', 1, 'active',
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)
  }

  async function createTestDbWithPositions(): Promise<D1Database> {
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

    // 役職マスタを投入
    await seedD1(
      db,
      "positions",
      seedPositions.map((position) => ({
        id: position.id,
        code: position.code,
        name: position.name,
        rank: position.rank,
        description: position.description,
        created_at: position.createdAt,
      })),
    )

    await enableVerifiedLifecycle(db)

    return db
  }

  const newEmployeeBase = {
    code: "E_NEW_1",
    name: "New Employee",
    email: "new@example.com",
    password: "Passw0rd1",
    role: "member",
    hire_on: "2026-01-01",
    department_code: null,
    position_title: null,
    manager_employee_code: null,
  }

  test("accepts valid position code when position master is populated", async () => {
    const db = await createTestDbWithPositions()
    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/employees",
      token,
      method: "POST",
      body: { ...newEmployeeBase, position_title: "ENG" },
    })

    // コードが存在する場合は正常に受理される（201）
    expect(response.status).toBe(201)
  })

  test("rejects unknown position code when position master is populated", async () => {
    const db = await createTestDbWithPositions()
    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/employees",
      token,
      method: "POST",
      body: {
        ...newEmployeeBase,
        code: "E_NEW_2",
        email: "new2@example.com",
        position_title: "NOPE",
      },
    })

    // ValidationError → 400, position_not_found
    expect(response.status).toBe(400)
    const body = (await response.json()) as { code: string }
    expect(body.code).toBe("position_not_found")
  })

  test("passes free-text position through when position master is empty", async () => {
    // マスタが空のとき: positions テーブルにレコード無し、ライフサイクル有効
    const db = await createTestDb()
    await enableVerifiedLifecycle(db)
    const token = await adminToken()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/employees",
      token,
      method: "POST",
      body: {
        ...newEmployeeBase,
        code: "E_NEW_3",
        email: "new3@example.com",
        position_title: "Intern",
      },
    })

    // マスタ未セットアップ → フリーテキストがそのまま通る
    expect(response.status).toBe(201)
  })
})
