import { Skill } from "@/contexts/skill/domain/entities/skill.entity"
import { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("SkillRepository", () => {
  test("findByCode returns the seeded skill", async () => {
    const { context, db } = await createTestContext()

    await seedD1(db, "skill_definitions", [
      {
        code: "TYPESCRIPT",
        name: "TypeScript",
        category: "language",
      },
    ])

    const repository = new SkillRepository(context)

    const found = await repository.findByCode("TYPESCRIPT")

    expect(found).toBeInstanceOf(Skill)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.name).toBe("TypeScript")
    expect(found.category).toBe("language")
  })
})
