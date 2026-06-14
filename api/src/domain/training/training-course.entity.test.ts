import { TrainingCourse } from "@/domain/training/training-course.entity"
import { describe, expect, test } from "bun:test"

describe("TrainingCourse.create", () => {
  test("builds with null id and active status", () => {
    const course = TrainingCourse.create({
      code: "TC001",
      title: "Security Basics",
      category: "compliance",
      description: "Introduction to security practices",
      durationMinutes: 60,
      isRequired: true,
    })

    expect(course).toBeInstanceOf(TrainingCourse)
    expect(course.id).toBe(null)
    expect(course.status).toBe("active")
    expect(course.title).toBe("Security Basics")
  })
})

describe("TrainingCourse.withDetails", () => {
  test("returns new with changed fields", () => {
    const course = TrainingCourse.create({
      code: "TC001",
      title: "Security Basics",
      category: "compliance",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    const updated = course.withDetails({
      title: "Advanced Security",
      category: "engineering",
      description: "Deep dive into security",
      durationMinutes: 120,
      isRequired: true,
    })

    expect(updated.title).toBe("Advanced Security")
    expect(updated.category).toBe("engineering")
    expect(updated.description).toBe("Deep dive into security")
    expect(updated.durationMinutes).toBe(120)
    expect(updated.isRequired).toBe(true)
    expect(updated.code).toBe("TC001")
    expect(updated.status).toBe("active")
  })
})

describe("TrainingCourse.archive", () => {
  test("returns new with archived status", () => {
    const course = TrainingCourse.create({
      code: "TC001",
      title: "Security Basics",
      category: "compliance",
      description: null,
      durationMinutes: null,
      isRequired: false,
    })

    const archived = course.archive()

    expect(archived.status).toBe("archived")
    expect(archived.code).toBe("TC001")
  })
})
