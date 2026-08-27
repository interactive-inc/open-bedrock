import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOnboardingAssignments } from "@/contexts/onboarding/test/seed/seed-onboarding-assignments.test-support"
import { seedOnboardingTasks } from "@/contexts/onboarding/test/seed/seed-onboarding-tasks.test-support"
import { seedOnboardingTemplates } from "@/contexts/onboarding/test/seed/seed-onboarding-templates.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const onboardingTaskResponseSchema = z.object({
  id: z.number(),
  template_task_code: z.string(),
  title: z.string(),
  order: z.number(),
  status: z.enum(["pending", "done"]),
  completed_at: z.string().nullable(),
})

const onboardingAssignmentResponseSchema = z.object({
  id: z.number(),
  employee_code: z.string(),
  employee_name: z.string(),
  template_code: z.string(),
  template_name: z.string(),
  kind: z.enum(["join", "leave"]),
  status: z.enum(["in_progress", "completed"]),
  assigned_at: z.string(),
  tasks: z.array(onboardingTaskResponseSchema).readonly(),
})

const jwtSecret = "onboarding-employee-code-route-test-secret"

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

  await seedD1(
    db,
    "onboarding_templates",
    seedOnboardingTemplates.map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      kind: template.kind,
      description: template.description,
    })),
  )

  const templateTaskRows: Array<Record<string, string | number | null>> = []

  for (const template of seedOnboardingTemplates) {
    for (const task of template.tasks) {
      templateTaskRows.push({
        template_code: template.code,
        code: task.code,
        title: task.title,
        sort_order: task.order,
        owner_role: task.ownerRole,
      })
    }
  }

  await seedD1(db, "onboarding_template_tasks", templateTaskRows)

  await seedD1(
    db,
    "onboarding_assignments",
    seedOnboardingAssignments.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employeeId,
      template_code: assignment.templateCode,
      kind: assignment.kind,
      status: assignment.status,
      assigned_at: assignment.assignedAt,
    })),
  )

  await seedD1(
    db,
    "onboarding_tasks",
    seedOnboardingTasks.map((task) => ({
      id: task.id,
      assignment_id: task.assignmentId,
      template_task_code: task.templateTaskCode,
      title: task.title,
      sort_order: task.order,
      status: task.status,
      completed_at: task.completedAt,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function token(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /onboarding-assignments/employees/:code", () => {
  test("a privileged role sees the employee assignments with tasks", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E005",
      token: await token(1),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.employee_code).toBe("E005")
      expect(parsed.data.data[0]?.tasks.length).toBe(2)
    }
  })

  test("a member is forbidden", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E005",
      token: await token(6),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E999",
      token: await token(1),
    })

    expect(response.status).toBe(404)
  })

  test("limit=1 returns at most one assignment", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E005?limit=1",
      token: await token(1),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(parsed.data.length).toBe(1)
  })

  test("offset beyond the assignment count returns an empty list", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E005?offset=1",
      token: await token(1),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(parsed.data.length).toBe(0)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding/onboarding-assignments/employees/E005",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})
