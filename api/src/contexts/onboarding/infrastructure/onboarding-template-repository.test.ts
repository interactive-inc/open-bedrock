import { OnboardingTemplate } from "@/contexts/onboarding/domain/onboarding-template.entity"
import { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/onboarding-template-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("OnboardingTemplateRepository", () => {
  test("findByCode returns a seeded template with its tasks", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "onboarding_templates", [
      {
        id: 1,
        code: "join-default",
        name: "入社手続き",
        kind: "join",
        description: null,
      },
    ])

    await seedD1(db, "onboarding_template_tasks", [
      {
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
    const { context } = createTestContext()

    const repository = new OnboardingTemplateRepository(context)

    const found = await repository.findByCode("unknown")

    expect(found).toBeNull()
  })
})
