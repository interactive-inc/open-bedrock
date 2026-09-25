import { Skill } from "@/contexts/skill/domain/entities/skill.entity"
import { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["findbycode-returns-the-seeded-skill"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("SkillRepository", () => {
  test("findByCode returns the seeded skill", async () => {
    const { context, db } = await createLocalD1Context(local, "findbycode-returns-the-seeded-skill")

    await seedD1(db, "skill_definitions", [
      {
        id: crypto.randomUUID(),
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
