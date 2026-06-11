import { TrainingEnrollment } from "@/domain/training/training-enrollment"
import { describe, expect, test } from "bun:test"

describe("TrainingEnrollment.create", () => {
  test("builds with null id, enrolled status, null completedAt and score", () => {
    const enrollment = TrainingEnrollment.create({
      courseId: 1,
      employeeId: 5,
      dueDate: "2026-03-31",
    })

    expect(enrollment).toBeInstanceOf(TrainingEnrollment)
    expect(enrollment.id).toBe(null)
    expect(enrollment.status).toBe("enrolled")
    expect(enrollment.completedAt).toBe(null)
    expect(enrollment.score).toBe(null)
  })
})

describe("TrainingEnrollment.complete", () => {
  test("returns new with completed status, completedAt, and score", () => {
    const enrollment = TrainingEnrollment.create({
      courseId: 1,
      employeeId: 5,
      dueDate: "2026-03-31",
    })

    const completed = enrollment.complete("2026-02-15T10:00:00.000Z", 85)

    expect(completed.status).toBe("completed")
    expect(completed.completedAt).toBe("2026-02-15T10:00:00.000Z")
    expect(completed.score).toBe(85)
  })
})

describe("TrainingEnrollment.withRescheduled", () => {
  test("returns new with changed dueDate", () => {
    const enrollment = TrainingEnrollment.create({
      courseId: 1,
      employeeId: 5,
      dueDate: "2026-03-31",
    })

    const rescheduled = enrollment.withRescheduled("2026-06-30")

    expect(rescheduled.dueDate).toBe("2026-06-30")
    expect(rescheduled.courseId).toBe(1)
  })
})
