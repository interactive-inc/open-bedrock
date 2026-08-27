import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewForm } from "@/contexts/performance-review/domain/entities/review-form.entity"
import { toReviewResultView } from "@/contexts/performance-review/interface/http/review-cycles/[cycle_id]/results/[employee_code]/to-review-result-view"
import { describe, expect, test } from "bun:test"

describe("toReviewResultView", () => {
  test("returns Error for unsaved cycle with null id", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const view = toReviewResultView(cycle, [], toWorkforceEmployeeId(1))

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
      subjectEmployeeId: toWorkforceEmployeeId(5),
      reviewerEmployeeId: toWorkforceEmployeeId(2),
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
      subjectEmployeeId: toWorkforceEmployeeId(5),
      reviewerEmployeeId: toWorkforceEmployeeId(3),
      reviewerType: "peer",
      answers: [],
      score: 60,
      comment: null,
      status: "submitted",
      submittedAt: "2026-01-02T00:00:00.000Z",
      visibility: "disclosed",
    })

    const view = toReviewResultView(cycle, [form1, form2], toWorkforceEmployeeId(5))

    if (view instanceof Error) {
      throw view
    }

    expect(view.cycleId).toBe(1)
    expect(view.subjectEmployeeId).toBe(toWorkforceEmployeeId(5))
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
      subjectEmployeeId: toWorkforceEmployeeId(5),
      reviewerEmployeeId: toWorkforceEmployeeId(2),
      reviewerType: "self",
      answers: [],
      score: null,
      comment: null,
      status: "pending",
      submittedAt: null,
      visibility: "disclosed",
    })

    const view = toReviewResultView(cycle, [pendingForm], toWorkforceEmployeeId(5))

    if (view instanceof Error) {
      throw view
    }

    expect(view.averageScore).toBe(null)
    expect(view.submittedCount).toBe(0)
  })
})
