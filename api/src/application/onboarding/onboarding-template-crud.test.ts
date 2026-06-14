import { CreateOnboardingTemplate } from "@/application/onboarding/create-onboarding-template"
import { DeleteOnboardingTemplate } from "@/application/onboarding/delete-onboarding-template"
import { GetOnboardingTemplate } from "@/application/onboarding/get-onboarding-template"
import { UpdateOnboardingTemplate } from "@/application/onboarding/update-onboarding-template"
import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { OnboardingTemplateRepository } from "@/infrastructure/onboarding/onboarding-template-repository"
import { employees } from "@/schema"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

async function seedTemplate(context: Context): Promise<void> {
  const repository = new OnboardingTemplateRepository(context)

  const created = await repository.create(
    OnboardingTemplate.create({
      code: "join-default",
      name: "入社手続き",
      kind: "join",
      description: "新入社員の初期設定",
    }),
  )

  if (created instanceof Error) {
    throw new Error("seed template failed")
  }
}

async function seedInProgressAssignment(context: Context, templateCode: string): Promise<void> {
  await context.var.database.insert(employees).values({
    id: 9001,
    code: "E9001",
    name: "Test User",
    email: "test9001@example.com",
    passwordHash: "x",
    role: "member",
    deptId: 1,
    deptName: "Dept",
    position: "Staff",
    status: "active",
  })

  const assignmentRepository = new OnboardingAssignmentRepository(context)

  const template = new OnboardingTemplate({
    id: 1,
    code: templateCode,
    name: "入社手続き",
    kind: "join",
    description: null,
    tasks: [],
  })

  const created = await assignmentRepository.create(
    OnboardingAssignment.create({
      employeeId: 9001,
      template,
      assignedAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error) {
    throw new Error("seed assignment failed")
  }
}

describe("CreateOnboardingTemplate", () => {
  test("a privileged role creates a template", async () => {
    const { context } = createTestContext()

    const created = await new CreateOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "engineer-join",
      name: "Engineer Onboarding",
      kind: "join",
      description: null,
    })

    expect(created instanceof OnboardingTemplate).toBe(true)

    if (created instanceof OnboardingTemplate) {
      expect(created.code).toBe("engineer-join")
      expect(created.id).not.toBeNull()
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const created = await new CreateOnboardingTemplate(context).run({
      viewerRole: "member",
      code: "engineer-join",
      name: "Engineer Onboarding",
      kind: "join",
      description: null,
    })

    expect(created instanceof OnboardingTemplate).toBe(false)

    if (created instanceof OnboardingTemplate === false && created instanceof Error === false) {
      expect(created.reason).toBe("forbidden")
    }
  })

  test("a duplicate code conflicts", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const created = await new CreateOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "join-default",
      name: "別の名称",
      kind: "join",
      description: null,
    })

    expect(created instanceof OnboardingTemplate).toBe(false)

    if (created instanceof OnboardingTemplate === false && created instanceof Error === false) {
      expect(created.reason).toBe("template_code_conflict")
    }
  })
})

describe("GetOnboardingTemplate", () => {
  test("a privileged role gets a template", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const found = await new GetOnboardingTemplate(context).run({
      viewerRole: "hr",
      code: "join-default",
    })

    expect(found instanceof OnboardingTemplate).toBe(true)
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const found = await new GetOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "unknown",
    })

    expect(found instanceof OnboardingTemplate === false && found instanceof Error === false).toBe(
      true,
    )

    if (found instanceof OnboardingTemplate === false && found instanceof Error === false) {
      expect(found.reason).toBe("template_not_found")
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const found = await new GetOnboardingTemplate(context).run({
      viewerRole: "member",
      code: "join-default",
    })

    if (found instanceof OnboardingTemplate === false && found instanceof Error === false) {
      expect(found.reason).toBe("forbidden")
    }
  })
})

describe("UpdateOnboardingTemplate", () => {
  test("a privileged role updates name and kind", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const updated = await new UpdateOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "join-default",
      name: "更新後の名称",
      kind: "leave",
      description: null,
    })

    expect(updated instanceof OnboardingTemplate).toBe(true)

    if (updated instanceof OnboardingTemplate) {
      expect(updated.name).toBe("更新後の名称")
      expect(updated.kind).toBe("leave")
      expect(updated.description).toBeNull()
    }
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const updated = await new UpdateOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "unknown",
      name: "x",
      kind: "join",
      description: null,
    })

    if (updated instanceof OnboardingTemplate === false && updated instanceof Error === false) {
      expect(updated.reason).toBe("template_not_found")
    }
  })
})

describe("DeleteOnboardingTemplate", () => {
  test("a privileged role deletes a template", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "join-default",
    })

    expect(result instanceof Error).toBe(false)

    if (result instanceof Error === false) {
      expect(result.reason).toBe("deleted")
    }

    const repository = new OnboardingTemplateRepository(context)

    const found = await repository.findByCode("join-default")

    expect(found).toBeNull()
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "unknown",
    })

    if (result instanceof Error === false) {
      expect(result.reason).toBe("template_not_found")
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      viewerRole: "member",
      code: "join-default",
    })

    if (result instanceof Error === false) {
      expect(result.reason).toBe("forbidden")
    }
  })

  test("returns template_in_use when in_progress assignments exist", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)
    await seedInProgressAssignment(context, "join-default")

    const result = await new DeleteOnboardingTemplate(context).run({
      viewerRole: "admin",
      code: "join-default",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("template_in_use")
  })
})
