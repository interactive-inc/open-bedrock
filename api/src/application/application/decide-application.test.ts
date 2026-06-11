import { Application } from "@/domain/application/application"
import { ApplicationTemplate } from "@/domain/application/application-template"
import { DecideApplication } from "@/application/application/decide-application"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
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
      viewerRole: "accountant",
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if ("reason" in result) {
      throw new Error(`unexpected reason: ${result.reason}`)
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
      viewerRole: "member",
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!("reason" in result)) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("falls back to canDecideApplication when approverRoles is empty", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_3", [])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    // manager is in canDecideApplication privileged roles
    const managerResult = await new DecideApplication(context).run({
      viewerRole: "manager",
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (managerResult instanceof Error) {
      throw managerResult
    }

    if ("reason" in managerResult) {
      throw new Error(`unexpected reason: ${managerResult.reason}`)
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
      viewerRole: "member",
      applicationId: application.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!("reason" in result)) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("returns forbidden for self-approval", async () => {
    const { context } = createTestContext()

    const templateRepository = new ApplicationTemplateRepository(context)
    const applicationRepository = new ApplicationRepository(context)

    const template = await seedTemplate(templateRepository, "role_test_5", ["manager"])

    const application = await seedPending(applicationRepository, template.id ?? 0, 5)

    const result = await new DecideApplication(context).run({
      viewerRole: "manager",
      applicationId: application.id ?? 0,
      approverId: 5,
      action: "approve",
      comment: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!("reason" in result)) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("forbidden")
  })
})
