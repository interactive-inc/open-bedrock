import { TrainingEnrollment } from "@/domain/training/training-enrollment"
import { TrainingEnrollmentRepository } from "@/infrastructure/training/training-enrollment-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("TrainingEnrollmentRepository", () => {
  test("create then findById round-trips the enrollment", async () => {
    const { context } = createTestContext()

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId: 1,
        employeeId: 2,
        dueDate: "2026-03-31",
      }),
    )

    expect(created).toBeInstanceOf(TrainingEnrollment)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("reason" in created) {
      throw new Error("unexpected already_enrolled")
    }

    if (created.id === null) {
      throw new Error("create returned null id")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(TrainingEnrollment)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.courseId).toBe(1)
    expect(found.employeeId).toBe(2)
    expect(found.status).toBe("enrolled")
  })

  test("update persists the completion", async () => {
    const { context } = createTestContext()

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId: 1,
        employeeId: 2,
        dueDate: null,
      }),
    )

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("reason" in created) {
      throw new Error("unexpected already_enrolled")
    }

    if (created.id === null) {
      throw new Error("create returned null id")
    }

    const updated = await repository.update(created.complete("2026-02-01T00:00:00.000Z", 90))

    expect(updated).toBeInstanceOf(TrainingEnrollment)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("completed")
    expect(updated.score).toBe(90)
  })

  test("findByCourseAndEmployee returns null when none matches", async () => {
    const { context } = createTestContext()

    const repository = new TrainingEnrollmentRepository(context)

    const found = await repository.findByCourseAndEmployee(9999, 9999)

    expect(found).toBeNull()
  })
})
