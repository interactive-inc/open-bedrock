import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
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

const onboardingTemplateResponseSchema = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["join", "leave"]),
  description: z.string().nullable(),
})

const jwtSecret = "onboarding-templates-crud-route-test-secret"

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

describe("POST /onboarding-templates", () => {
  test("a privileged role creates a template", async () => {
    const response = await request({
      path: "/onboarding-templates",
      token: await token(1),
      method: "POST",
      body: { code: "manager_join", name: "Manager Onboarding", kind: "join", description: null },
    })

    expect(response.status).toBe(201)

    const parsed = onboardingTemplateResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("manager_join")
      expect(parsed.data.id).not.toBeNull()
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding-templates",
      token: await token(5),
      method: "POST",
      body: { code: "manager_join", name: "Manager Onboarding", kind: "join" },
    })

    expect(response.status).toBe(403)
  })

  test("a duplicate code conflicts", async () => {
    const response = await request({
      path: "/onboarding-templates",
      token: await token(1),
      method: "POST",
      body: { code: "engineer_join", name: "Dup", kind: "join" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/onboarding-templates",
      token: null,
      method: "POST",
      body: { code: "x", name: "y", kind: "join" },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 for an invalid body", async () => {
    const response = await request({
      path: "/onboarding-templates",
      token: await token(1),
      method: "POST",
      body: { code: "x", name: "y", kind: "bogus" },
    })

    expect(response.status).toBe(400)
  })
})

describe("GET /onboarding-templates/:code", () => {
  test("a privileged role gets a template", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(1),
    })

    expect(response.status).toBe(200)

    const parsed = onboardingTemplateResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.code).toBe("engineer_join")
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(5),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/onboarding-templates/unknown",
      token: await token(1),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /onboarding-templates/:code", () => {
  test("a privileged role updates a template", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(1),
      method: "PUT",
      body: { name: "Updated", kind: "leave", description: null },
    })

    expect(response.status).toBe(200)

    const parsed = onboardingTemplateResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.name).toBe("Updated")
      expect(parsed.data.kind).toBe("leave")
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(5),
      method: "PUT",
      body: { name: "Updated", kind: "join" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/onboarding-templates/unknown",
      token: await token(1),
      method: "PUT",
      body: { name: "Updated", kind: "join" },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /onboarding-templates/:code", () => {
  test("a privileged role deletes a template", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("a non-privileged role is forbidden", async () => {
    const response = await request({
      path: "/onboarding-templates/engineer_join",
      token: await token(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown code", async () => {
    const response = await request({
      path: "/onboarding-templates/unknown",
      token: await token(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })
})
