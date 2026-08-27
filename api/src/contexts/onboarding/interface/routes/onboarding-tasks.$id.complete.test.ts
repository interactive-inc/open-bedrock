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

const jwtSecret = "onboarding-tasks-complete-route-test-secret"

const fixedNow = "2026-01-01T00:00:00.000Z"

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

describe("POST /onboarding-tasks/:id/complete", () => {
  test("owner completes a task and gets 200 with done status", async () => {
    const response = await request({
      path: "/onboarding-tasks/200/complete",
      token: await token(5),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = onboardingTaskResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("done")
      expect(parsed.data.completed_at).toBe(fixedNow)
    }
  })

  test("completing every task flips the assignment to completed", async () => {
    const db = await createTestDb()

    const ownerToken = await token(5)

    await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-tasks/200/complete",
      token: ownerToken,
      method: "POST",
    })

    await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-tasks/201/complete",
      token: ownerToken,
      method: "POST",
    })

    const showResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-assignments/employees/E005",
      token: await token(1),
    })

    const parsed = z
      .object({ data: z.array(onboardingAssignmentResponseSchema), total: z.number() })
      .safeParse(await showResponse.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data[0]?.status).toBe("completed")
    }
  })

  test("a non-owner member is forbidden", async () => {
    const response = await request({
      path: "/onboarding-tasks/200/complete",
      token: await token(6),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown task", async () => {
    const response = await request({
      path: "/onboarding-tasks/9999/complete",
      token: await token(1),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-integer task id", async () => {
    const response = await request({
      path: "/onboarding-tasks/abc/complete",
      token: await token(1),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding-tasks/200/complete",
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })

  test("concurrent complete: second request returns current done status, not stale pending", async () => {
    // Simulates two requests that both read `pending` before either writes.
    // The first completes the task; the second hits the guard abort.
    // The second response must reflect the DB state (`done`), not the pre-fetch snapshot.
    const db = await createTestDb()
    const ownerToken = await token(5)

    // First request: task 200 is pending → completes it to done.
    const first = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-tasks/200/complete",
      token: ownerToken,
      method: "POST",
    })

    expect(first.status).toBe(200)

    // Second request on the same DB: task is already done, guard aborts.
    // Response must still return the current `done` state, not the old `pending` snapshot.
    const second = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding-tasks/200/complete",
      token: ownerToken,
      method: "POST",
    })

    expect(second.status).toBe(200)

    const parsed = onboardingTaskResponseSchema.safeParse(await second.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("done")
      expect(parsed.data.completed_at).toBe(fixedNow)
    }
  })
})
