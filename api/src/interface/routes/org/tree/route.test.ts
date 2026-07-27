import { describe, expect, test } from "bun:test"
import { seedDepartments } from "@/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/infrastructure/seed/seed-org-departments"
import { seedOrgMemberships } from "@/infrastructure/seed/seed-org-memberships"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

type OrgTreeNodeResponse = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNodeResponse>
}

const orgTreeNodeResponseSchema: z.ZodType<OrgTreeNodeResponse> = z.lazy(() =>
  z.object({
    code: z.string(),
    name: z.string(),
    manager_employee_code: z.string().nullable(),
    member_count: z.number(),
    children: z.array(orgTreeNodeResponseSchema),
  }),
)

const jwtSecret = "org-tree-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

  return db
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

describe("GET /org/tree", () => {
  test("returns 200 with a recursive tree of root departments", async () => {
    const response = await request("/org/tree", await memberToken())

    expect(response.status).toBe(200)

    const parsed = z.array(orgTreeNodeResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.code).toBe("D001")
      expect(parsed.data[0]?.name).toBe("Corporate Planning")
      expect(parsed.data[0]?.children.length).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/org/tree", null)

    expect(response.status).toBe(401)
  })

  test("derives current manager and member counts from lifecycle facts", async () => {
    const db = await createTestDb()
    await db.exec(`
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-5', 1, 5, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-5', 1, 'employment-5', 5, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-1', 1, 'employment-1', 1, 'D003', 'primary', 'Director', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-5', 1, 'employment-5', 5, 'D003', 'primary', 'Engineer', 1, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_responsibility_period_versions
        (period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('responsibility-1', 1, 'D003', 'department_manager', 1,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/org/tree",
      token: await memberToken(),
    })

    expect(response.status).toBe(200)
    const roots = z.array(orgTreeNodeResponseSchema).parse(await response.json())
    const engineering = roots[0]?.children.find((department) => department.code === "D003")
    expect(engineering).toEqual(
      expect.objectContaining({ manager_employee_code: "E001", member_count: 2 }),
    )
  })
})
