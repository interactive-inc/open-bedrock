import { ApplicationTemplate } from "@/domain/application/application-template"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

describe("ApplicationTemplateRepository", () => {
  test("findByCode returns a seeded template", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
      {
        id: 1,
        code: "expense",
        name: "経費申請",
        category: "expense",
        description: null,
        schema_json: "{}",
        approver_roles: "[]",
      },
    ])

    const repository = new ApplicationTemplateRepository(context)

    const found = await repository.findByCode("expense")

    expect(found).toBeInstanceOf(ApplicationTemplate)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.code).toBe("expense")
  })

  test("findByCode returns null for an unknown code", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationTemplateRepository(context)

    const found = await repository.findByCode("unknown")

    expect(found).toBeNull()
  })
})
