import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["findbyid-returns-the-seeded-posting", "findbyid-returns-null-for-an-unknown-id"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("CareerPostingRepository", () => {
  test("findById returns the seeded posting", async () => {
    const { context, db } = await createLocalD1Context(local, "findbyid-returns-the-seeded-posting")

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
    const { context } = await createLocalD1Context(local, "findbyid-returns-null-for-an-unknown-id")

    const repository = new CareerPostingRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
