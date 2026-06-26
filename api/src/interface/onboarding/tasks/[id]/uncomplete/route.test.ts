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

const jwtSecret = "onboarding-tasks-uncomplete-route-test-secret"

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

describe("POST /onboarding/tasks/:id/uncomplete", () => {
  test("owner uncompletes a previously completed task and gets pending status", async () => {
    const db = await createTestDb()

    const ownerToken = await token(5, "member")

    await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding/tasks/200/complete",
      token: ownerToken,
      method: "POST",
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/onboarding/tasks/200/uncomplete",
      token: ownerToken,
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = onboardingTaskResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.completed_at).toBe(null)
    }
  })

  test("a non-owner member is forbidden", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/onboarding/tasks/200/uncomplete",
      token: await token(6, "member"),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown task", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/onboarding/tasks/9999/uncomplete",
      token: await token(1, "admin"),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-integer task id", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/onboarding/tasks/abc/uncomplete",
      token: await token(1, "admin"),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/onboarding/tasks/200/uncomplete",
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
