import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ReviewForm } from "@/contexts/performance-review/domain/entities/review-form.entity"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-form.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "findbyid-returns-the-seeded-review-form",
      "update-persists-the-submission",
      "update-returns-null-when-the-form-is-already",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("ReviewFormRepository", () => {
  test("findById returns the seeded review form", async () => {
    const { context, db } = await createLocalD1Context(
      local,
      "findbyid-returns-the-seeded-review-form",
    )

    await seedD1(db, "review_forms", [
      {
        id: "01900033-0000-7000-8000-000000000001",
        cycle_id: "01900032-0000-7000-8000-000000000001",
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

    const found = await repository.findById("01900033-0000-7000-8000-000000000001")

    expect(found).toBeInstanceOf(ReviewForm)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.reviewerType).toBe("manager")
    expect(found.status).toBe("pending")
  })

  test("update persists the submission", async () => {
    const { context, db } = await createLocalD1Context(local, "update-persists-the-submission")

    await seedD1(db, "review_cycles", [
      {
        id: "01900032-0000-7000-8000-000000000001",
        title: "2026-H1",
        period: "2026-H1",
        status: "open",
        due_date: null,
      },
    ])

    await seedD1(db, "review_forms", [
      {
        id: "01900033-0000-7000-8000-000000000001",
        cycle_id: "01900032-0000-7000-8000-000000000001",
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

    const found = await repository.findById("01900033-0000-7000-8000-000000000001")

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
    const { context, db } = await createLocalD1Context(
      local,
      "update-returns-null-when-the-form-is-already",
    )

    await seedD1(db, "review_forms", [
      {
        id: "01900033-0000-7000-8000-000000000001",
        cycle_id: "01900032-0000-7000-8000-000000000001",
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
      id: "01900033-0000-7000-8000-000000000001",
      cycleId: "01900032-0000-7000-8000-000000000001",
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
