import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CreateOnboardingTemplate } from "@/contexts/onboarding/application/create-onboarding-template"
import { DeleteOnboardingTemplate } from "@/contexts/onboarding/application/delete-onboarding-template"
import { UpdateOnboardingTemplate } from "@/contexts/onboarding/application/update-onboarding-template"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import {
  createFakeAssignmentRepository,
  createFakeTemplateRepository,
} from "@/contexts/onboarding/test/onboarding-repository-fakes.test-support"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

/** テンプレートと割り当てのRepositoryを型付きfakeにして、DBなしで業務判断を検証する。 */
function createTemplateTestContext(options: { lifecycleBoundCodes?: ReadonlyArray<string> } = {}) {
  return {
    templateRepository: createFakeTemplateRepository(options),
    assignmentRepository: createFakeAssignmentRepository(),
  }
}

type TemplateTestContext = ReturnType<typeof createTemplateTestContext>

async function seedTemplate(context: TemplateTestContext): Promise<void> {
  const created = await context.templateRepository.create(
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

async function seedInProgressAssignment(
  context: TemplateTestContext,
  templateCode: string,
): Promise<void> {
  const template = new OnboardingTemplate({
    id: "0190003c-0000-7000-8000-000000000001",
    code: templateCode,
    name: "入社手続き",
    kind: "join",
    description: null,
    tasks: [],
  })

  const created = await context.assignmentRepository.create(
    OnboardingAssignment.create({
      employeeId: toWorkforceEmployeeId(9001),
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
    const context = createTemplateTestContext()

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
    const context = createTemplateTestContext()

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
    const context = createTemplateTestContext()

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

  test("a unique constraint race on create conflicts", async () => {
    const context = createTemplateTestContext()

    const created = await new CreateOnboardingTemplate({
      templateRepository: {
        findByCode: async () => null,
        create: async () => new UniqueConstraintError("onboarding template code already exists"),
      },
    }).run({
      session: makeTestSession("root"),
      code: "join-default",
      name: "並行登録",
      kind: "join",
      description: null,
    })

    expectApplicationError(created, ConflictError, "template_code_conflict")
    expect(context.templateRepository.templates.size).toBe(0)
  })
})

describe("GetOnboardingTemplate", () => {})

describe("UpdateOnboardingTemplate", () => {
  test("a privileged role updates name and kind", async () => {
    const context = createTemplateTestContext()

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
    const context = createTemplateTestContext()

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
    const context = createTemplateTestContext({ lifecycleBoundCodes: ["join-default"] })
    await seedTemplate(context)

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
    const context = createTemplateTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
    })

    expect(result instanceof Error).toBe(false)

    if (result instanceof Error === false) {
      expect(result.reason).toBe("deleted")
    }

    const found = await context.templateRepository.findByCode("join-default")

    expect(found).toBeNull()
  })

  test("an unknown code is not found", async () => {
    const context = createTemplateTestContext()

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "unknown",
    })

    expectApplicationError(result, NotFoundError, "template_not_found")
  })

  test("does not delete a lifecycle-bound template", async () => {
    const context = createTemplateTestContext({ lifecycleBoundCodes: ["join-default"] })
    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
    })

    expectApplicationError(result, ConflictError, "template_in_use")
  })

  test("a non-privileged role is forbidden", async () => {
    const context = createTemplateTestContext()

    await seedTemplate(context)

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("member"),
      code: "join-default",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns template_in_use when in_progress assignments exist", async () => {
    const context = createTemplateTestContext()

    await seedTemplate(context)
    await seedInProgressAssignment(context, "join-default")

    const result = await new DeleteOnboardingTemplate(context).run({
      session: makeTestSession("root"),
      code: "join-default",
    })

    expectApplicationError(result, ConflictError, "template_in_use")
  })
})
