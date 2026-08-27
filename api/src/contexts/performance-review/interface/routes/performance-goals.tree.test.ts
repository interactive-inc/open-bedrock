import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const jwtSecret = "goal-tree-route-test-secret"

type TreeNode = {
  id: number
  owner_type: string
  employee_id: EmployeeId
  children: Array<TreeNode>
}

const treeNodeSchema: z.ZodType<TreeNode> = z.object({
  id: z.number(),
  owner_type: z.string(),
  employee_id: zEmployeeId,
  children: z.array(z.lazy(() => treeNodeSchema)),
})

const treeResponseSchema = z.object({
  period: z.string().nullable(),
  roots: z.array(treeNodeSchema),
})

/** 全社(1)→部門 D003(2)→個人(E005=3) と、部門 D004(4)→個人(E010=5) の階層を仕込む。 */
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await initializeCompanyMembershipTestState(
    db,
    seedOrgMemberships.map((membership) => ({
      departmentCode: membership.departmentCode,
      employeeCode: membership.employeeCode,
      managerEmployeeCode: membership.managerEmployeeCode,
    })),
  )

  await seedD1(db, "performance_goals", [
    {
      id: 1,
      employee_id: "1",
      period: "2026-H1",
      title: "Company goal",
      kpi: null,
      weight: 100,
      status: "in_progress",
      owner_type: "company",
      parent_goal_id: null,
      department_code: null,
    },
    {
      id: 2,
      employee_id: "4",
      period: "2026-H1",
      title: "D003 dept goal",
      kpi: null,
      weight: 50,
      status: "in_progress",
      owner_type: "department",
      parent_goal_id: 1,
      department_code: "D003",
    },
    {
      id: 3,
      employee_id: "5",
      period: "2026-H1",
      title: "E005 individual goal",
      kpi: null,
      weight: 40,
      status: "in_progress",
      owner_type: "individual",
      parent_goal_id: 2,
      department_code: null,
    },
    {
      id: 4,
      employee_id: "9",
      period: "2026-H1",
      title: "D004 dept goal",
      kpi: null,
      weight: 50,
      status: "in_progress",
      owner_type: "department",
      parent_goal_id: 1,
      department_code: "D004",
    },
    {
      id: 5,
      employee_id: "10",
      period: "2026-H1",
      title: "E010 individual goal",
      kpi: null,
      weight: 60,
      status: "in_progress",
      owner_type: "individual",
      parent_goal_id: 4,
      department_code: null,
    },
  ])

  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

/** 全ノードを平坦化して owner_type / id を数えやすくする。 */
function flatten(nodes: ReadonlyArray<TreeNode>): Array<TreeNode> {
  const all: Array<TreeNode> = []

  for (const node of nodes) {
    all.push(node)

    for (const child of flatten(node.children)) {
      all.push(child)
    }
  }

  return all
}

describe("GET /performance-goals/tree", () => {
  test("admin sees the full tree including all individual leaves", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals/tree?period=2026-H1",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = treeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.roots.length).toBe(1)

      const root = parsed.data.roots[0]

      expect(root?.owner_type).toBe("company")

      const all = flatten(parsed.data.roots)

      expect(all.length).toBe(5)

      const individualIds = all
        .filter((node) => node.owner_type === "individual")
        .map((node) => node.id)
        .sort((a, b) => a - b)

      expect(individualIds).toEqual([3, 5])
    }
  })

  test("company and department nodes are visible but out-of-scope individual leaves are hidden", async () => {
    // E005(id 5, member) は自分の個人目標(id 3)だけ見える。E010(id 5 の目標)は見えない。
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals/tree?period=2026-H1",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = treeResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const all = flatten(parsed.data.roots)

      const ownerTypes = all.map((node) => node.owner_type).sort()

      // company + department x2 は残り、individual は自分の 1 件だけ。
      expect(all.filter((node) => node.owner_type === "company").length).toBe(1)
      expect(all.filter((node) => node.owner_type === "department").length).toBe(2)

      const individualIds = all
        .filter((node) => node.owner_type === "individual")
        .map((node) => node.id)

      expect(individualIds).toEqual([3])
      expect(ownerTypes.length).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/performance-review/performance-goals/tree",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})
