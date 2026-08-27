import { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import { TrainingEnrollment } from "@/contexts/training/domain/entities/training-enrollment.entity"
import { TrainingCourseRepository } from "@/contexts/training/infrastructure/repositories/training-course.repository"
import { TrainingEnrollmentRepository } from "@/contexts/training/infrastructure/repositories/training-enrollment.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import type { Context } from "@/env"
import { describe, expect, test } from "bun:test"

/** テスト用のアクティブなコースを作成してそのIDを返す。 */
async function seedActiveCourse(context: Context) {
  const repo = new TrainingCourseRepository(context)
  const course = await repo.create(
    TrainingCourse.create({
      code: "TEST-101",
      title: "Test Course",
      category: "test",
      description: null,
      durationMinutes: 60,
      isRequired: false,
    }),
  )
  if (course instanceof Error || course.id === null) {
    throw new Error("failed to seed course")
  }
  return course.id
}

describe("TrainingEnrollmentRepository", () => {
  test("create then findById round-trips the enrollment", async () => {
    const { context } = createTestContext()

    const courseId = await seedActiveCourse(context)

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId,
        employeeId: 2,
        dueDate: "2026-03-31",
      }),
    )

    expect(created).toBeInstanceOf(TrainingEnrollment)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("reason" in created) {
      throw new Error(`unexpected reason: ${created.reason}`)
    }

    if (created.id === null) {
      throw new Error("create returned null id")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(TrainingEnrollment)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.courseId).toBe(courseId)
    expect(found.employeeId).toBe(2)
    expect(found.status).toBe("enrolled")
  })

  test("create returns course_archived when course is archived", async () => {
    const { context } = createTestContext()

    const courseRepo = new TrainingCourseRepository(context)
    const course = await courseRepo.create(
      TrainingCourse.create({
        code: "ARC-101",
        title: "Archived Course",
        category: "test",
        description: null,
        durationMinutes: 30,
        isRequired: false,
      }),
    )
    if (course instanceof Error) throw new Error("seed failed")
    await courseRepo.update(course.archive())

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId: course.id!,
        employeeId: 2,
        dueDate: null,
      }),
    )

    expect(created).not.toBeInstanceOf(Error)
    expect(created).toEqual({ reason: "course_archived" })
  })

  test("completeEnrollment persists the completion", async () => {
    const { context } = createTestContext()

    const courseId = await seedActiveCourse(context)

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId,
        employeeId: 2,
        dueDate: null,
      }),
    )

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("reason" in created) {
      throw new Error(`unexpected reason: ${created.reason}`)
    }

    if (created.id === null) {
      throw new Error("create returned null id")
    }

    const updated = await repository.completeEnrollment(
      created.complete("2026-02-01T00:00:00.000Z", 90),
    )

    expect(updated).toBeInstanceOf(TrainingEnrollment)

    if (updated instanceof Error || updated === null) {
      throw new Error("completeEnrollment failed")
    }

    expect(updated.status).toBe("completed")
    expect(updated.score).toBe(90)
  })

  test("delete returns null for completed enrollment", async () => {
    const { context } = createTestContext()

    const courseId = await seedActiveCourse(context)

    const repository = new TrainingEnrollmentRepository(context)

    const created = await repository.create(
      TrainingEnrollment.create({
        courseId,
        employeeId: 2,
        dueDate: null,
      }),
    )

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("create failed")
    }

    await repository.completeEnrollment(created.complete("2026-02-01T00:00:00.000Z", 90))

    const deleted = await repository.delete(created.id)

    expect(deleted).toBeNull()
  })

  test("findByCourseAndEmployee returns null when none matches", async () => {
    const { context } = createTestContext()

    const repository = new TrainingEnrollmentRepository(context)

    const found = await repository.findByCourseAndEmployee(9999, 9999)

    expect(found).toBeNull()
  })
})
