import { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import { TrainingCourseRepository } from "@/contexts/training/infrastructure/repositories/training-course.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "create-then-findbycode-round-trips-the-course",
      "findbyid-returns-null-for-an-unknown-id",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("TrainingCourseRepository", () => {
  test("create then findByCode round-trips the course", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbycode-round-trips-the-course",
    )

    const repository = new TrainingCourseRepository(context)

    const created = await repository.create(
      TrainingCourse.create({
        code: "SEC-101",
        title: "情報セキュリティ基礎",
        category: "security",
        description: null,
        durationMinutes: 60,
        isRequired: true,
      }),
    )

    expect(created).toBeInstanceOf(TrainingCourse)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findByCode("SEC-101")

    expect(found).toBeInstanceOf(TrainingCourse)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.title).toBe("情報セキュリティ基礎")
    expect(found.status).toBe("active")

    const foundById = await repository.findById(created.id)

    expect(foundById).toBeInstanceOf(TrainingCourse)
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = await createLocalD1Context(local, "findbyid-returns-null-for-an-unknown-id")

    const repository = new TrainingCourseRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
