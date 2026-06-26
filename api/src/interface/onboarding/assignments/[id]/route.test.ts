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
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
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
  kind: z.enum(["join", "leave"]),
  status: z.enum(["in_progress", "completed"]),
  assigned_at: z.string(),
  tasks: z.array(onboardingTaskResponseSchema).readonly(),
})

const jwtSecret = "onboarding-assignment-detail-route-test-secret"

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

describe("GET /onboarding/assignments/:id", () => {
  test("the owner sees their own assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = onboardingAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(100)
      expect(parsed.data.tasks.length).toBe(2)
    }
  })

  test("a privileged role sees another employee's assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(200)
  })

  test("a non-owner member is forbidden", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(6, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/9999",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-integer assignment id", async () => {
    const response = await request({
      path: "/onboarding/assignments/abc",
      token: await token(1, "admin"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/onboarding/assignments/100", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /onboarding/assignments/:id", () => {
  test("a privileged role reschedules the assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(1, "admin"),
      method: "PUT",
      body: { assigned_at: "2026-06-01T00:00:00Z" },
    })

    expect(response.status).toBe(200)

    const parsed = onboardingAssignmentResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.assigned_at).toBe("2026-06-01T00:00:00Z")
    }
  })

  test("the owner without a privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(5, "member"),
      method: "PUT",
      body: { assigned_at: "2026-06-01T00:00:00Z" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/9999",
      token: await token(1, "admin"),
      method: "PUT",
      body: { assigned_at: "2026-06-01T00:00:00Z" },
    })

    expect(response.status).toBe(404)
  })

  test("rejects a non-ISO-datetime assigned_at with 400", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(1, "admin"),
      method: "PUT",
      body: { assigned_at: "2026-06-01" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: null,
      method: "PUT",
      body: { assigned_at: "2026-06-01T00:00:00Z" },
    })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /onboarding/assignments/:id", () => {
  test("returns 403 for non-privileged role", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(6, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("a privileged role cancels the assignment and gets 204", async () => {
    const db = await createTestDb()

    const deleteResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding/assignments/100",
      token: await token(1, "admin"),
      method: "DELETE",
    })

    expect(deleteResponse.status).toBe(204)

    const getResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding/assignments/100",
      token: await token(1, "admin"),
    })

    expect(getResponse.status).toBe(404)
  })

  test("the owner without a privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: await token(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown assignment", async () => {
    const response = await request({
      path: "/onboarding/assignments/9999",
      token: await token(1, "admin"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding/assignments/100",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
