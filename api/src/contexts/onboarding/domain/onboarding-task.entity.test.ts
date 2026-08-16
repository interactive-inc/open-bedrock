import { OnboardingTask } from "@/contexts/onboarding/domain/onboarding-task.entity"
import { describe, expect, test } from "bun:test"

describe("OnboardingTask.create", () => {
  test("builds with null id, pending status, null completedAt", () => {
    const task = OnboardingTask.create({
      templateTaskCode: "T001",
      title: "Submit documents",
      order: 1,
    })

    expect(task).toBeInstanceOf(OnboardingTask)
    expect(task.id).toBe(null)
    expect(task.assignmentId).toBe(null)
    expect(task.status).toBe("pending")
    expect(task.completedAt).toBe(null)
  })
})

describe("OnboardingTask.complete", () => {
  test("returns new task with done status and completedAt", () => {
    const task = OnboardingTask.create({
      templateTaskCode: "T001",
      title: "Submit documents",
      order: 1,
    })

    const completed = task.complete("2026-01-15T10:00:00.000Z")

    expect(completed.status).toBe("done")
    expect(completed.completedAt).toBe("2026-01-15T10:00:00.000Z")
  })
})

describe("OnboardingTask.uncomplete", () => {
  test("returns new task with pending status and null completedAt", () => {
    const task = OnboardingTask.create({
      templateTaskCode: "T001",
      title: "Submit documents",
      order: 1,
    })

    const completed = task.complete("2026-01-15T10:00:00.000Z")
    const uncompleted = completed.uncomplete()

    expect(uncompleted.status).toBe("pending")
    expect(uncompleted.completedAt).toBe(null)
  })
})
