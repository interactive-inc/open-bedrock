import { describe, expect, test } from "bun:test"
import { CreateReviewCycle } from "@/contexts/performance-review/application/review/create-review-cycle"
import { DeleteReviewCycle } from "@/contexts/performance-review/application/review/delete-review-cycle"
import { SetReviewCycleStatus } from "@/contexts/performance-review/application/review/set-review-cycle-status"
import { SubmitReviewForm } from "@/contexts/performance-review/application/review/submit-review-form"
import { UpdateReviewCycle } from "@/contexts/performance-review/application/review/update-review-cycle"
import { ReviewCycle } from "@/contexts/performance-review/domain/review/review-cycle.entity"
import { ReviewForm } from "@/contexts/performance-review/domain/review/review-form.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/review/review-cycle-repository"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"
import { makeTestSession } from "@/api/test/support/make-test-session"

async function seedCycle(context: Context, status: "draft" | "open" | "closed"): Promise<number> {
  const created = await new ReviewCycleRepository(context).create(
    new ReviewCycle({
      id: null,
      title: "Test Cycle",
      period: "2026-H1",
      status: status,
      dueDate: null,
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed cycle failed")
  }

  return created.id
}

async function seedForm(
  context: Context,
  cycleId: number,
  reviewerEmployeeId: number,
  status: "pending" | "submitted",
): Promise<number> {
  const db = context.env.DB

  const result = await db
    .prepare(
      `INSERT INTO review_forms (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, comment, status, submitted_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      cycleId,
      10,
      reviewerEmployeeId,
      "peer",
      "[]",
      null,
      null,
      status,
      status === "submitted" ? "2026-01-15T00:00:00.000Z" : null,
    )
    .run()

  const formId = result.meta.last_row_id

  if (formId === undefined) {
    throw new Error("seed form failed")
  }

  return Number(formId)
}

describe("CreateReviewCycle", () => {
  test("creates a draft cycle with admin role", async () => {
    const { context } = createTestContext()

    const created = await new CreateReviewCycle(context).run({
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
  })

  test("creates a draft cycle with hr role", async () => {
    const { context } = createTestContext()

    const created = await new CreateReviewCycle(context).run({
      session: makeTestSession("hr"),
      title: "HR Cycle",
      period: "2026-Q1",
      dueDate: null,
    })

    expect(created).toBeInstanceOf(ReviewCycle)
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const result = await new CreateReviewCycle(context).run({
      session: makeTestSession("member"),
      title: "Cycle",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("DeleteReviewCycle", () => {
  test("deletes a draft cycle", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
  })

  test("returns not_deletable for an open cycle", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
  })

  test("returns not_deletable for a closed cycle", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "closed")

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { context } = createTestContext()

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: 9999,
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("member"),
      cycleId: cycleId,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  // D1 の json_extract('', '$') を使ったガード。
  // 前の DELETE が 0 行のとき malformed JSON エラーでバッチを中断し、
  // 後続の review_forms 削除を防ぐ（レースコンディション対策）。
  test("guard aborts batch when cycle was concurrently changed from draft", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")
    await seedForm(context, cycleId, 5, "pending")

    // draft→open に変更して削除条件 (status='draft') を満たさなくする
    const db = context.env.DB

    await db.prepare("UPDATE review_cycles SET status = 'open' WHERE id = ?1").bind(cycleId).run()

    const result = await new DeleteReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
    })

    // isDeletable チェックで弾かれる
    expectApplicationError(result, ConflictError, "not_deletable")
  })
})

describe("SetReviewCycleStatus", () => {
  test("transitions draft to open", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      status: "open",
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.status).toBe("open")
  })

  test("transitions open to closed", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      status: "closed",
    })

    expect(result).toBeInstanceOf(ReviewCycle)

    if (result instanceof ReviewCycle === false) {
      throw new Error("expected ReviewCycle")
    }

    expect(result.status).toBe("closed")
  })

  test("returns invalid_transition for draft to closed", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      status: "closed",
    })

    expectApplicationError(result, ConflictError, "invalid_transition")
  })

  test("returns invalid_transition for closed to open", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "closed")

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      status: "open",
    })

    expectApplicationError(result, ConflictError, "invalid_transition")
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { context } = createTestContext()

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("root"),
      cycleId: 9999,
      status: "open",
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const result = await new SetReviewCycleStatus(context).run({
      session: makeTestSession("member"),
      cycleId: 1,
      status: "open",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("UpdateReviewCycle", () => {
  test("updates a draft cycle", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")

    const result = await new UpdateReviewCycle(context).run({
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
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")

    const result = await new UpdateReviewCycle(context).run({
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
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "closed")

    const result = await new UpdateReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: cycleId,
      title: "Should Fail",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })

  test("returns cycle_not_found for a missing cycle", async () => {
    const { context } = createTestContext()

    const result = await new UpdateReviewCycle(context).run({
      session: makeTestSession("root"),
      cycleId: 9999,
      title: "Missing",
      period: "2026-H1",
      dueDate: null,
    })

    expectApplicationError(result, NotFoundError, "cycle_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const result = await new UpdateReviewCycle(context).run({
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
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")
    const formId = await seedForm(context, cycleId, 5, "pending")

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 5,
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
    const { context } = createTestContext()

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 5,
      formId: 9999,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "form_not_found")
  })

  test("returns forbidden when viewer is not the assigned reviewer", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")
    const formId = await seedForm(context, cycleId, 5, "pending")

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 99,
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns already_submitted for an already submitted form", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "open")
    const formId = await seedForm(context, cycleId, 5, "submitted")

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 5,
      formId: formId,
      score: 90,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_submitted")
  })

  test("returns cycle_not_open when cycle is draft", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "draft")
    const formId = await seedForm(context, cycleId, 5, "pending")

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 5,
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "cycle_not_open")
  })

  test("returns cycle_not_open when cycle is closed", async () => {
    const { context } = createTestContext()

    const cycleId = await seedCycle(context, "closed")
    const formId = await seedForm(context, cycleId, 5, "pending")

    const result = await new SubmitReviewForm(context).run({
      viewerEmployeeId: 5,
      formId: formId,
      score: null,
      answers: [],
      comment: null,
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "cycle_not_open")
  })
})
