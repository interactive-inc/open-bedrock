import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOnboardingAssignments } from "@/infrastructure/seed/seed-onboarding-assignments"
import { seedOnboardingTasks } from "@/infrastructure/seed/seed-onboarding-tasks"
import { seedOnboardingTemplates } from "@/infrastructure/seed/seed-onboarding-templates"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

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

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

  return db
}

function token(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
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

describe("GET /onboarding/employee/:code", () => {
  test("a privileged role sees the employee assignments with tasks", async () => {
    const response = await request({
      path: "/onboarding/employee/E005",
      token: await token(1, "admin"),
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
      path: "/onboarding/employee/E005",
      token: await token(6, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee", async () => {
    const response = await request({
      path: "/onboarding/employee/E999",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(404)
  })

  test("limit=1 returns at most one assignment", async () => {
    const response = await request({
      path: "/onboarding/employee/E005?limit=1",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(parsed.data.length).toBe(1)
  })

  test("offset beyond the assignment count returns an empty list", async () => {
    const response = await request({
      path: "/onboarding/employee/E005?offset=1",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .parse(await response.json())

    expect(parsed.data.length).toBe(0)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/onboarding/employee/E005", token: null })

    expect(response.status).toBe(401)
  })
})
