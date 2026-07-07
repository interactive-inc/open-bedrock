import { ReviewCycle } from "@/domain/review/review-cycle.entity"
import { ReviewForm } from "@/domain/review/review-form.entity"
import { toReviewResultView } from "@/lib/review/to-review-result-view"
import { describe, expect, test } from "bun:test"

describe("toReviewResultView", () => {
  test("returns Error for unsaved cycle with null id", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const view = toReviewResultView(cycle, [], 1)

    expect(view).toBeInstanceOf(Error)
  })

  test("builds result view with correct averageScore from submitted forms", () => {
    const cycle = ReviewCycle.fromRow({
      id: 1,
      title: "2026H1",
      period: "2026-H1",
      status: "open",
      dueDate: null,
    })

    const form1 = new ReviewForm({
      id: 1,
      cycleId: 1,
      subjectEmployeeId: 5,
      reviewerEmployeeId: 2,
      reviewerType: "manager",
      answers: [],
      score: 80,
      comment: null,
      status: "submitted",
      submittedAt: "2026-01-01T00:00:00.000Z",
      visibility: "disclosed",
    })

    const form2 = new ReviewForm({
      id: 2,
      cycleId: 1,
      subjectEmployeeId: 5,
      reviewerEmployeeId: 3,
      reviewerType: "peer",
      answers: [],
      score: 60,
      comment: null,
      status: "submitted",
      submittedAt: "2026-01-02T00:00:00.000Z",
      visibility: "disclosed",
    })

    const view = toReviewResultView(cycle, [form1, form2], 5)

    if (view instanceof Error) {
      throw view
    }

    expect(view.cycleId).toBe(1)
    expect(view.subjectEmployeeId).toBe(5)
    expect(view.formCount).toBe(2)
    expect(view.submittedCount).toBe(2)
    expect(view.averageScore).toBe(70)
  })

  test("returns null averageScore when no submitted forms with scores", () => {
    const cycle = ReviewCycle.fromRow({
      id: 1,
      title: "2026H1",
      period: "2026-H1",
      status: "open",
      dueDate: null,
    })

    const pendingForm = new ReviewForm({
      id: 1,
      cycleId: 1,
      subjectEmployeeId: 5,
      reviewerEmployeeId: 2,
      reviewerType: "self",
      answers: [],
      score: null,
      comment: null,
      status: "pending",
      submittedAt: null,
      visibility: "disclosed",
    })

    const view = toReviewResultView(cycle, [pendingForm], 5)

    if (view instanceof Error) {
      throw view
    }

    expect(view.averageScore).toBe(null)
    expect(view.submittedCount).toBe(0)
  })
})
