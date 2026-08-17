import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedOnboardingAssignments } from "@/contexts/onboarding/infrastructure/seed/seed-onboarding-assignments"
import { seedOnboardingTasks } from "@/contexts/onboarding/infrastructure/seed/seed-onboarding-tasks"
import { seedOnboardingTemplates } from "@/contexts/onboarding/infrastructure/seed/seed-onboarding-templates"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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

const jwtSecret = "onboarding-assign-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

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

describe("POST /onboarding-assignments", () => {
  test("assigns a template to an employee and returns 201", async () => {
    const response = await request({
      path: "/onboarding-assignments",
      token: await token(2, "hr"),
      method: "POST",
      body: { employee_code: "E003", template_code: "engineer_join" },
    })

    expect(response.status).toBe(201)

    const parsed = onboardingAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_code).toBe("E003")
      expect(parsed.data.template_code).toBe("engineer_join")
      expect(parsed.data.status).toBe("in_progress")
      expect(parsed.data.tasks.length).toBe(2)
      expect(parsed.data.assigned_at).toBe(fixedNow)
    }
  })

  test("returns 404 for an unknown employee", async () => {
    const response = await request({
      path: "/onboarding-assignments",
      token: await token(2, "hr"),
      method: "POST",
      body: { employee_code: "E999", template_code: "engineer_join" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown template", async () => {
    const response = await request({
      path: "/onboarding-assignments",
      token: await token(2, "hr"),
      method: "POST",
      body: { employee_code: "E003", template_code: "missing" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when employee_code is missing", async () => {
    const response = await request({
      path: "/onboarding-assignments",
      token: await token(2, "hr"),
      method: "POST",
      body: { template_code: "engineer_join" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 409 when the same template is assigned to the same employee twice", async () => {
    const db = await createTestDb()

    // employee E005 already has assignment id 100 for engineer_join (seed data)
    const secondResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-assignments",
      token: await token(2, "hr"),
      method: "POST",
      body: { employee_code: "E005", template_code: "engineer_join" },
    })

    expect(secondResponse.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding-assignments",
      token: null,
      method: "POST",
      body: { employee_code: "E003", template_code: "engineer_join" },
    })

    expect(response.status).toBe(401)
  })
})
