import { Application } from "@/domain/application/application.entity"
import { ApplicationTemplate } from "@/domain/application/application-template.entity"
import { DecideApplication } from "@/application/application/decide-application"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { ForbiddenError } from "@/lib/errors"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

async function seedTemplate(
  repository: ApplicationTemplateRepository,
  code: string,
  approverRoles: ReadonlyArray<string>,
): Promise<ApplicationTemplate> {
  const created = await repository.create(
    ApplicationTemplate.create({
      code,
      name: `Template ${code}`,
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles,
    }),
  )

  if (created instanceof Error) {
    throw created
  }

  return created
}

async function seedPending(
  repository: ApplicationRepository,
  templateId: number,
  applicantId: number,
): Promise<Application> {
  const created = await repository.create(
    Application.create({
      templateId,
      applicantId,
      currentStep: null,
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error) {
    throw created
  }

  return created
}

describe("DecideApplication", () => {
  test("approves when viewer role is listed in approverRoles", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_1", ["accountant", "admin"])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    const result = await new DecideApplication(context).run({
      session: makeTestSession("accountant"),
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.status).toBe("approved")
  })

  test("returns forbidden when viewer role is not listed in approverRoles", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_2", ["accountant"])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    const result = await new DecideApplication(context).run({
      session: makeTestSession("member"),
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("falls back to canDecideApplication when approverRoles is empty", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", status: "active" },
      { id: 5, code: "E005", name: "Applicant", status: "active" },
    ])
    await seedD1(db, "org_memberships", [
      { department_code: "TEAM", employee_code: "E005", manager_employee_code: "E002" },
    ])

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_3", [])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    // manager is in canDecideApplication privileged roles
    const managerResult = await new DecideApplication(context).run({
      session: makeTestSession("manager"),
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (managerResult instanceof Error) {
      throw managerResult
    }

    expect(managerResult.status).toBe("approved")
  })

  test("returns forbidden when approverRoles is empty and viewer is not privileged", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_4", [])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    const result = await new DecideApplication(context).run({
      session: makeTestSession("member"),
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns forbidden for self-approval", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_5", ["manager"])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    const result = await new DecideApplication(context).run({
      session: makeTestSession("manager"),
      applicationId: application.id ?? 0,
      approverId: 5,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})
