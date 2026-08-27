import { CreateOnboardingTemplate } from "@/contexts/onboarding/application/create-onboarding-template"
import { DeleteOnboardingTemplate } from "@/contexts/onboarding/application/delete-onboarding-template"
import { UpdateOnboardingTemplate } from "@/contexts/onboarding/application/update-onboarding-template"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { createTestContext } from "@/api/test/support/create-test-context"
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
      session: makeTestSession("root"),
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
      session: makeTestSession("member"),
      code: "engineer-join",
      name: "Engineer Onboarding",
      kind: "join",
      description: null,
    })

    expect(created instanceof OnboardingTemplate).toBe(false)

    expectApplicationError(created, ForbiddenError, "forbidden")
  })

  test("a duplicate code conflicts", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const created = await new CreateOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
      name: "別の名称",
      kind: "join",
      description: null,
    })

    expect(created instanceof OnboardingTemplate).toBe(false)

    expectApplicationError(created, ConflictError, "template_code_conflict")
  })
})

describe("GetOnboardingTemplate", () => {})

describe("UpdateOnboardingTemplate", () => {
  test("a privileged role updates name and kind", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const updated = await new UpdateOnboardingTemplate(context).run({
      session: makeTestSession("root"),
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
      session: makeTestSession("root"),
      code: "unknown",
      name: "x",
      kind: "join",
      description: null,
    })

    expectApplicationError(updated, NotFoundError, "template_not_found")
  })

  test("does not change the kind of a lifecycle-bound template", async () => {
    const { context } = createTestContext()
    await seedTemplate(context)
    await context.env.DB.prepare(
      `INSERT INTO lifecycle_effect_template_bindings
         (effect_type, template_code, updated_at, updated_by_account_id)
       VALUES ('hire', 'join-default', 1, NULL)`,
    ).run()

    const updated = await new UpdateOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
      name: "変更後",
      kind: "leave",
      description: null,
    })

    expectApplicationError(updated, ValidationError, "lifecycle_binding_kind_conflict")
  })
})

describe("DeleteOnboardingTemplate", () => {
  test("a privileged role deletes a template", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
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
      session: makeTestSession("root"),
      code: "unknown",
    })

    expectApplicationError(result, NotFoundError, "template_not_found")
  })

  test("does not delete a lifecycle-bound template", async () => {
    const { context } = createTestContext()
    await seedTemplate(context)
    await context.env.DB.prepare(
      `INSERT INTO lifecycle_effect_template_bindings
         (effect_type, template_code, updated_at, updated_by_account_id)
       VALUES ('hire', 'join-default', 1, NULL)`,
    ).run()

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
    })

    expectApplicationError(result, ConflictError, "template_in_use")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("member"),
      code: "join-default",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns template_in_use when in_progress assignments exist", async () => {
    const { context } = createTestContext()

    await seedTemplate(context)
    await seedInProgressAssignment(context, "join-default")

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
    })

    expectApplicationError(result, ConflictError, "template_in_use")
  })
})
