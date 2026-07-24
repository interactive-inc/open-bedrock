import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedOnboardingAssignments } from "@/infrastructure/seed/seed-onboarding-assignments"
import { seedOnboardingTasks } from "@/infrastructure/seed/seed-onboarding-tasks"
import { seedOnboardingTemplates } from "@/infrastructure/seed/seed-onboarding-templates"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const onboardingTemplateResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.enum(["join", "leave"]),
  description: z.string().nullable(),
  task_count: z.number(),
  lifecycle_effect: z.enum(["hire", "retired"]).nullable(),
})

const jwtSecret = "onboarding-templates-route-test-secret"

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

  await seedD1(db, "lifecycle_effect_template_bindings", [
    {
      effect_type: "hire",
      template_code: "engineer_join",
      updated_at: 1,
      updated_by_account_id: 1,
    },
  ])

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

describe("GET /onboarding/templates", () => {
  test("returns 200 with the template response shape", async () => {
    const response = await request({
      path: "/onboarding/templates",
      token: await token(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const engineerJoin = parsed.data.data.find((template) => template.code === "engineer_join")

      expect(engineerJoin?.task_count).toBe(2)
      expect(engineerJoin?.lifecycle_effect).toBe("hire")

      const commonLeave = parsed.data.data.find((template) => template.code === "common_leave")
      expect(commonLeave?.lifecycle_effect).toBeNull()
    }
  })

  test("filters templates by kind", async () => {
    const response = await request({
      path: "/onboarding/templates?kind=leave",
      token: await token(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.code).toBe("common_leave")
    }
  })

  test("returns 400 for an invalid kind", async () => {
    const response = await request({
      path: "/onboarding/templates?kind=bogus",
      token: await token(1, "root"),
    })

    expect(response.status).toBe(400)
  })

  test("returns only 1 template when limit=1 and task_count reflects that template", async () => {
    const response = await request({
      path: "/onboarding/templates?limit=1",
      token: await token(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(onboardingTemplateResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)

      const returned = parsed.data.data[0]

      // engineer_join is the first seed template and has 2 tasks
      expect(returned?.code).toBe("engineer_join")
      expect(returned?.task_count).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/onboarding/templates", token: null })

    expect(response.status).toBe(401)
  })

  test("returns 403 for a member without onboarding:manage", async () => {
    const response = await request({
      path: "/onboarding/templates",
      token: await token(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 200 for a manager with onboarding:manage", async () => {
    const response = await request({
      path: "/onboarding/templates",
      token: await token(4, "manager"),
    })

    expect(response.status).toBe(200)
  })
})

describe("/onboarding/templates/:code/lifecycle-binding", () => {
  test("sets and removes a compatible lifecycle binding", async () => {
    const updated = await request({
      path: "/onboarding/templates/common_leave/lifecycle-binding",
      token: await token(1, "root"),
      method: "PUT",
      body: { effect_type: "retired" },
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({
      effect_type: "retired",
      template_code: "common_leave",
    })

    const removed = await request({
      path: "/onboarding/templates/engineer_join/lifecycle-binding",
      token: await token(1, "root"),
      method: "DELETE",
    })
    expect(removed.status).toBe(204)
  })

  test("rejects incompatible kinds and callers without management permission", async () => {
    const incompatible = await request({
      path: "/onboarding/templates/common_leave/lifecycle-binding",
      token: await token(1, "root"),
      method: "PUT",
      body: { effect_type: "hire" },
    })
    expect(incompatible.status).toBe(400)

    const forbidden = await request({
      path: "/onboarding/templates/engineer_join/lifecycle-binding",
      token: await token(5, "member"),
      method: "DELETE",
    })
    expect(forbidden.status).toBe(403)
  })
})
