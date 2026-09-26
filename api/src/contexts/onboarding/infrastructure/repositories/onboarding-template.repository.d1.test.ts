import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"
import { seedD1 } from "@tests/api/support/seed-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "bound",
      "in-use",
      "findbycode-returns-a-seeded-template-with-its",
      "findbycode-returns-null-for-an-unknown-code",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

function joinTemplate(): OnboardingTemplate {
  return OnboardingTemplate.create({
    code: "join-default",
    name: "入社手続き",
    kind: "join",
    description: "新入社員の初期設定",
  })
}

describe("OnboardingTemplateRepository on local D1", () => {
  test("a lifecycle binding blocks a kind change and a delete but not a rename", async () => {
    const { context, db } = await createLocalD1Context(local, "bound")

    const repository = new OnboardingTemplateRepository(context)

    const created = await repository.create(joinTemplate())

    if (created instanceof Error) throw created

    expect(await repository.create(joinTemplate())).toBeInstanceOf(UniqueConstraintError)

    await db
      .prepare(
        `INSERT INTO onboarding_lifecycle_template_bindings
           (id, effect_type, template_code, updated_at, updated_by_account_id)
         VALUES ('01900040-0000-7000-8000-000000000001', 'hire', 'join-default', 1, NULL)`,
      )
      .run()

    const kindChanged = await repository.update(
      created.withDetails({ name: "変更後", kind: "leave", description: null }),
    )

    expect(kindChanged).toBeNull()

    const renamed = await repository.update(
      created.withDetails({ name: "変更後", kind: "join", description: null }),
    )

    expect(renamed instanceof OnboardingTemplate ? renamed.name : renamed).toBe("変更後")
    expect(await repository.delete(created)).toBeNull()
    expect(await repository.findByCode("join-default")).not.toBeNull()
  })

  test("an in_progress assignment blocks a delete until it is completed", async () => {
    const { context } = await createLocalD1Context(local, "in-use")

    const repository = new OnboardingTemplateRepository(context)

    const created = await repository.create(joinTemplate())

    if (created instanceof Error) throw created

    const assignments = new OnboardingAssignmentRepository(context)

    const assignment = await assignments.create(
      OnboardingAssignment.create({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        template: created,
        assignedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (assignment instanceof Error) throw assignment

    expect(await assignments.countActiveByTemplateCode("join-default")).toBe(1)
    expect(await repository.delete(created)).toBeNull()

    const completed = await assignments.update(assignment.updateStatus("completed"))

    if (completed instanceof Error) throw completed

    expect(await assignments.countActiveByTemplateCode("join-default")).toBe(0)
    expect(await repository.delete(created)).toBe(true)
    expect(await repository.findByCode("join-default")).toBeNull()
  })
})

describe("OnboardingTemplateRepository", () => {
  test("findByCode returns a seeded template with its tasks", async () => {
    const { context, db } = await createLocalD1Context(
      local,
      "findbycode-returns-a-seeded-template-with-its",
    )

    await seedD1(db, "onboarding_templates", [
      {
        id: "0190003c-0000-7000-8000-000000000001",
        code: "join-default",
        name: "入社手続き",
        kind: "join",
        description: null,
      },
    ])

    await seedD1(db, "onboarding_template_tasks", [
      {
        id: "01900038-0000-7000-8000-000000000001",
        template_code: "join-default",
        code: "account",
        title: "アカウント発行",
        sort_order: 1,
        owner_role: null,
      },
    ])

    const repository = new OnboardingTemplateRepository(context)

    const found = await repository.findByCode("join-default")

    expect(found).toBeInstanceOf(OnboardingTemplate)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.code).toBe("join-default")
    expect(found.tasks.length).toBe(1)
    expect(found.tasks[0]?.code).toBe("account")
  })

  test("findByCode returns null for an unknown code", async () => {
    const { context } = await createLocalD1Context(
      local,
      "findbycode-returns-null-for-an-unknown-code",
    )

    const repository = new OnboardingTemplateRepository(context)

    const found = await repository.findByCode("unknown")

    expect(found).toBeNull()
  })
})
