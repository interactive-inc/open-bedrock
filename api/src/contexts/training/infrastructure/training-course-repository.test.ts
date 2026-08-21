import { TrainingCourse } from "@/contexts/training/domain/training-course.entity"
import { TrainingCourseRepository } from "@/contexts/training/infrastructure/training-course.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("TrainingCourseRepository", () => {
  test("create then findByCode round-trips the course", async () => {
    const { context } = createTestContext()

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
    const { context } = createTestContext()

    const repository = new TrainingCourseRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })
})
