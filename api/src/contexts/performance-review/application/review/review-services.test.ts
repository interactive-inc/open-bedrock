import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateReviewCycle } from "@/contexts/performance-review/application/review/create-review-cycle"
import { DeleteReviewCycle } from "@/contexts/performance-review/application/review/delete-review-cycle"
import { CloseReviewCycle } from "@/contexts/performance-review/application/review/close-review-cycle"
import { OpenReviewCycle } from "@/contexts/performance-review/application/review/open-review-cycle"
import { SubmitReviewForm } from "@/contexts/performance-review/application/review/submit-review-form"
import { UpdateReviewCycle } from "@/contexts/performance-review/application/review/update-review-cycle"
import { defaultReviewCyclePolicy } from "@/contexts/performance-review/domain/definitions/review-cycle-policy.definition"
import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewForm } from "@/contexts/performance-review/domain/entities/review-form.entity"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"

type CycleStatus = "draft" | "open" | "closed"

/**
 * 評価サイクルと評価フォームのRepository・Adapterを型付きfakeにする。
 * 条件付き状態更新、batch削除、フォーム生成のSQLは performance-review/test/review-cycle.d1.test.ts が検証する。
 */
function createReviewPorts() {
  const cycles = new Map<number, ReviewCycle>()
  const forms = new Map<number, ReviewForm>()
  const policies = new Map<number, unknown>()
  const generatedFor: number[] = []

  const store = (cycle: ReviewCycle, id: number) => {
    const stored = new ReviewCycle({
      id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      dueDate: cycle.dueDate,
    })
    cycles.set(id, stored)
    return stored
  }

  const reviewCycleRepository = {
    findById: async (cycleId: number) => cycles.get(cycleId) ?? null,
    create: async (cycle: ReviewCycle) => store(cycle, cycles.size + 1),
    delete: async (cycleId: number) => {
      cycles.delete(cycleId)
      return null
    },
    updateStatus: async (cycle: ReviewCycle, previousStatus: ReviewCycle["status"]) => {
      if (cycle.id === null || cycles.get(cycle.id)?.status !== previousStatus) return null
      cycles.set(cycle.id, cycle)
      return cycle
    },
    updateDetails: async (cycle: ReviewCycle) => {
      if (cycle.id === null || cycles.get(cycle.id)?.status === "closed") return null
      cycles.set(cycle.id, cycle)
      return cycle
    },
    deleteWithForms: async (cycle: ReviewCycle) => {
      if (cycle.id === null) return null
      cycles.delete(cycle.id)
      for (const form of forms.values()) {
        if (form.cycleId === cycle.id) forms.delete(form.id)
      }
      return null
    },
  }

  const reviewFormRepository = {
    findById: async (formId: number) => forms.get(formId) ?? null,
    update: async (form: ReviewForm) => {
      if (forms.get(form.id)?.status !== "pending") return null
      forms.set(form.id, form)
      return form
    },
  }

  const reviewCyclePolicyAdapter = {
    upsert: async (cycleId: number, policy: unknown) => {
      policies.set(cycleId, policy)
      return null
    },
    find: async () => defaultReviewCyclePolicy,
  }

  const reviewFormGenerationAdapter = {
    generate: async (props: { cycleId: number }) => {
      generatedFor.push(props.cycleId)
      return 0
    },
  }

  const seedCycle = (status: CycleStatus): number =>
    store(
      new ReviewCycle({ id: null, title: "Test Cycle", period: "2026-H1", status, dueDate: null }),
      cycles.size + 1,
    ).id ?? -1

  const seedForm = (
    cycleId: number,
    reviewerEmployeeId: number,
    status: "pending" | "submitted",
  ): number => {
    const id = forms.size + 1
    forms.set(
      id,
      new ReviewForm({
        id,
        cycleId,
        subjectEmployeeId: toWorkforceEmployeeId(10),
        reviewerEmployeeId: toWorkforceEmployeeId(reviewerEmployeeId),
        reviewerType: "peer",
        answers: [],
        score: null,
        comment: null,
        status,
        submittedAt: status === "submitted" ? "2026-01-15T00:00:00.000Z" : null,
        visibility: "hidden",
      }),
    )
    return id
  }

  return {
    ports: {
      reviewCycleRepository,
      reviewFormRepository,
      reviewCyclePolicyAdapter,
      reviewFormGenerationAdapter,
    },
    cycles,
    forms,
    policies,
    generatedFor,
    seedCycle,
    seedForm,
  }
}

describe("CreateReviewCycle", () => {
  test("creates a draft cycle with admin role", async () => {
    const { ports, policies } = createReviewPorts()

    const created = await new CreateReviewCycle(ports).run({
      session: makeTestSession("root"),
      title: "2026 H1 Review",
      period: "2026-H1",
      dueDate: "2026-06-30",
    })

    expect(created).toBeInstanceOf(ReviewCycle)

    if (created instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(created.title).toBe("2026 H1 Review")
    expect(created.period).toBe("2026-H1")
    expect(created.status).toBe("draft")
    expect(created.dueDate).toBe("2026-06-30")
    expect(created.id === null ? undefined : policies.get(created.id)).toEqual(
      defaultReviewCyclePolicy,
    )
  })

  test("creates a draft cycle with hr role", async () => {
    const { ports } = createReviewPorts()

    const created = await new CreateReviewCycle(ports).run({
      session: makeTestSession("hr"),
      title: "HR Cycle",
      period: "2026-Q1",
      dueDate: null,
    })

    expect(created).toBeInstanceOf(ReviewCycle)
  })

  test("returns forbidden for member role", async () => {
    const { ports, cycles } = createReviewPorts()

    const result = await new CreateReviewCycle(ports).run({
      session: makeTestSession("member"),
      title: "Cycle",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(cycles.size).toBe(0)
  })

  test("removes the created cycle when the policy cannot be saved", async () => {
    const { ports, cycles } = createReviewPorts()

    const result = await new CreateReviewCycle({
      ...ports,
      reviewCyclePolicyAdapter: { upsert: async () => new Error("policy write failed") },
    }).run({
      session: makeTestSession("root"),
      title: "Cycle",
      period: "2026-H1",
      dueDate: null,
    })

    expect(result).toBeInstanceOf(Error)
    expect(cycles.size).toBe(0)
  })
})

describe("DeleteReviewCycle", () => {
  test("deletes a draft cycle", async () => {
    const { ports, cycles, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("draft")

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
    expect(cycles.has(cycleId)).toBe(false)
  })

  test("returns not_deletable for an open cycle", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("open")

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
  })

  test("returns not_deletable for a closed cycle", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("closed")

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { ports } = createReviewPorts()

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: 9999,
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { ports, cycles, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("draft")

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("member"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(cycles.has(cycleId)).toBe(true)
  })

  test("keeps forms of a cycle that was changed from draft before deletion", async () => {
    const { ports, cycles, forms, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("draft")
    const formId = seedForm(cycleId, 5, "pending")
    const current = cycles.get(cycleId)?.open()

    if (current === null || current === undefined) throw new Error("open failed")

    cycles.set(cycleId, current)

    const result = await new DeleteReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
    expect(forms.has(formId)).toBe(true)
  })
})

describe("OpenReviewCycle / CloseReviewCycle", () => {
  test("transitions draft to open", async () => {
    const { ports, generatedFor, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("draft")

    const result = await new OpenReviewCycle(ports).execute({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.status).toBe("open")
    expect(generatedFor).toEqual([cycleId])
  })

  test("transitions open to closed", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("open")

    const result = await new CloseReviewCycle(ports).execute({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.status).toBe("closed")
  })

  test("returns invalid_transition for draft to closed", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("draft")

    const result = await new CloseReviewCycle(ports).execute({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "invalid_transition")
  })

  test("returns invalid_transition for closed to open", async () => {
    const { ports, generatedFor, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("closed")

    const result = await new OpenReviewCycle(ports).execute({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "invalid_transition")
    expect(generatedFor).toEqual([])
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { ports } = createReviewPorts()

    const result = await new OpenReviewCycle(ports).execute({
      session: makeTestSession("root"),
      cycleId: 9999,
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { ports } = createReviewPorts()

    const result = await new OpenReviewCycle(ports).execute({
      session: makeTestSession("member"),
      cycleId: 1,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("UpdateReviewCycle", () => {
  test("updates a draft cycle", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("draft")

    const result = await new UpdateReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      title: "Updated Title",
      period: "2026-H2",
      dueDate: "2026-12-31",
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.title).toBe("Updated Title")
    expect(result.period).toBe("2026-H2")
    expect(result.dueDate).toBe("2026-12-31")
  })

  test("updates an open cycle", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("open")

    const result = await new UpdateReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      title: "Open Updated",
      period: "2026-H1",
      dueDate: null,
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.title).toBe("Open Updated")
  })

  test("returns not_modifiable for a closed cycle", async () => {
    const { ports, seedCycle } = createReviewPorts()

    const cycleId = seedCycle("closed")

    const result = await new UpdateReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      title: "Should Fail",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { ports } = createReviewPorts()

    const result = await new UpdateReviewCycle(ports).run({
      session: makeTestSession("root"),
      cycleId: 9999,
      title: "Missing",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { ports } = createReviewPorts()

    const result = await new UpdateReviewCycle(ports).run({
      session: makeTestSession("member"),
      cycleId: 1,
      title: "Should Fail",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("SubmitReviewForm", () => {
  test("submits a pending form in an open cycle", async () => {
    const { ports, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("open")
    const formId = seedForm(cycleId, 5, "pending")

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(5),
      formId: formId,
      score: 80,
      answers: [{ q: 1, a: "good" }],
      comment: "Great work",
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ReviewForm)

    if (result instanceof ReviewForm === false) {
      throw new Error("expected ReviewForm")
    }

    expect(result.status).toBe("submitted")
    expect(result.score).toBe(80)
    expect(result.comment).toBe("Great work")
  })

  test("returns form_not_found for a missing form", async () => {
    const { ports } = createReviewPorts()

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(5),
      formId: 9999,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "form_not_found")
  })

  test("returns forbidden when viewer is not the assigned reviewer", async () => {
    const { ports, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("open")
    const formId = seedForm(cycleId, 5, "pending")

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(99),
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns already_submitted for an already submitted form", async () => {
    const { ports, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("open")
    const formId = seedForm(cycleId, 5, "submitted")

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(5),
      formId: formId,
      score: 90,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_submitted")
  })

  test("returns cycle_not_open when cycle is draft", async () => {
    const { ports, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("draft")
    const formId = seedForm(cycleId, 5, "pending")

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(5),
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "cycle_not_open")
  })

  test("returns cycle_not_open when cycle is closed", async () => {
    const { ports, seedCycle, seedForm } = createReviewPorts()

    const cycleId = seedCycle("closed")
    const formId = seedForm(cycleId, 5, "pending")

    const result = await new SubmitReviewForm(ports).run({
      viewerEmployeeId: toWorkforceEmployeeId(5),
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "cycle_not_open")
  })
})
