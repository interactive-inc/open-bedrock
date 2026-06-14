import { Skill } from "@/domain/skill/skill.entity"
import { SkillRepository } from "@/infrastructure/skill/skill-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

describe("SkillRepository", () => {
  test("findByCode returns the seeded skill", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "skills", [
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
