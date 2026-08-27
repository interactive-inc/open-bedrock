import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ReviewForm } from "@/contexts/performance-review/domain/entities/review-form.entity"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-form.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("ReviewFormRepository", () => {
  test("findById returns the seeded review form", async () => {
    const { context, db } = await createTestContext()

    await seedD1(db, "review_forms", [
      {
        id: 1,
        cycle_id: 1,
        subject_employee_id: "2",
        reviewer_employee_id: "3",
        reviewer_type: "manager",
        answers: "[]",
        score: null,
        status: "pending",
        submitted_at: null,
      },
    ])

    const repository = new ReviewFormRepository(context)

    const found = await repository.findById(1)

    expect(found).toBeInstanceOf(ReviewForm)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.reviewerType).toBe("manager")
    expect(found.status).toBe("pending")
  })

  test("update persists the submission", async () => {
    const { context, db } = await createTestContext()

    await seedD1(db, "review_cycles", [
      { id: 1, title: "2026-H1", period: "2026-H1", status: "open", due_date: null },
    ])

    await seedD1(db, "review_forms", [
      {
        id: 1,
        cycle_id: 1,
        subject_employee_id: "2",
        reviewer_employee_id: "3",
        reviewer_type: "manager",
        answers: "[]",
        score: null,
        status: "pending",
        submitted_at: null,
      },
    ])

    const repository = new ReviewFormRepository(context)

    const found = await repository.findById(1)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    const updated = await repository.update(
      found.withSubmission(80, ["回答"], "Good progress", "2026-05-31T00:00:00.000Z"),
    )

    expect(updated).toBeInstanceOf(ReviewForm)

    if (updated instanceof Error || updated === null || (updated !== null && "reason" in updated)) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("submitted")
    expect(updated.score).toBe(80)
  })

  test("update returns null when the form is already submitted", async () => {
    const { context, db } = await createTestContext()

    await seedD1(db, "review_forms", [
      {
        id: 1,
        cycle_id: 1,
        subject_employee_id: "2",
        reviewer_employee_id: "3",
        reviewer_type: "manager",
        answers: '["prior answer"]',
        score: 90,
        status: "submitted",
        submitted_at: "2026-05-30T00:00:00.000Z",
      },
    ])

    const repository = new ReviewFormRepository(context)

    const form = new ReviewForm({
      id: 1,
      cycleId: 1,
      subjectEmployeeId: toWorkforceEmployeeId(2),
      reviewerEmployeeId: toWorkforceEmployeeId(3),
      reviewerType: "manager",
      answers: ["overwrite attempt"],
      score: 50,
      comment: null,
      status: "submitted",
      submittedAt: "2026-05-31T00:00:00.000Z",
      visibility: "disclosed",
    })

    const result = await repository.update(form)

    expect(result).toBeNull()
  })
})
