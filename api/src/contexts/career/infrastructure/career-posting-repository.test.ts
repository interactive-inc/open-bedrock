import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("CareerPostingRepository", () => {
  test("findById returns the seeded posting", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "career_postings", [
      {
        id: 1,
        title: "バックエンドエンジニア",
        dept_id: null,
        dept_name: null,
        required_skills: null,
        status: "open",
      },
    ])

    const repository = new CareerPostingRepository(context)

    const found = await repository.findById(1)

    expect(found).toBeInstanceOf(CareerPosting)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("バックエンドエンジニア")
    expect(found.status).toBe("open")
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = createTestContext()

    const repository = new CareerPostingRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
