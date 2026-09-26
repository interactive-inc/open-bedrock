import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { CloseReviewCycle } from "@/contexts/performance-review/application/review/close-review-cycle"
import { CreateReviewCycle } from "@/contexts/performance-review/application/review/create-review-cycle"
import { OpenReviewCycle } from "@/contexts/performance-review/application/review/open-review-cycle"
import { UpdateReviewCycle } from "@/contexts/performance-review/application/review/update-review-cycle"
import { ReviewCycle } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewCyclePolicyAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-cycle-policy.adapter"
import { ReviewFormGenerationAdapter } from "@/contexts/performance-review/infrastructure/adapters/review/review-form-generation.adapter"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review/review-cycle.repository"
import type { Context } from "@/env"
import { ConflictError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["lifecycle", "delete-guard"] })
})

afterAll(async () => {
  await local.dispose()
})

/** routeと同じ実装をportへ組み立てる。 */
function reviewPorts(context: Context) {
  return {
    reviewCycleRepository: new ReviewCycleRepository(context),
    reviewCyclePolicyAdapter: new ReviewCyclePolicyAdapter(context),
    reviewFormGenerationAdapter: new ReviewFormGenerationAdapter(context),
  }
}

async function seedCycle(context: Context, status: "draft" | "open"): Promise<ReviewCycle> {
  const created = await new ReviewCycleRepository(context).create(
    new ReviewCycle({ id: null, title: "Test Cycle", period: "2026-H1", status, dueDate: null }),
  )

  if (created instanceof Error || created.id === null) throw new Error("seed cycle failed")

  return created
}

async function seedPendingForm(db: D1Database, cycleId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO review_forms (id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, comment, status, submitted_at)
       VALUES (?2, ?1, '01900062-0000-7000-8000-00000000000a', '01900062-0000-7000-8000-000000000005', 'peer', '[]', NULL, NULL, 'pending', NULL)`,
    )
    .bind(cycleId, crypto.randomUUID())
    .run()
}

async function formCount(db: D1Database, cycleId: string): Promise<number> {
  const row = await db
    .prepare("SELECT count(*) AS count FROM review_forms WHERE cycle_id = ?1")
    .bind(cycleId)
    .first<{ count: number }>()
  return row?.count ?? -1
}

describe("review cycle persistence on local D1", () => {
  test("creates with a policy, opens with form generation, updates and closes with conditional status updates", async () => {
    const { context } = await createLocalD1Context(local, "lifecycle", {
      withCompanyOrganization: true,
    })
    const session = makeTestSession("root")

    const created = await new CreateReviewCycle(reviewPorts(context)).run({
      session,
      title: "2026 H1 Review",
      period: "2026-H1",
      dueDate: "2026-06-30",
    })

    if (!(created instanceof ReviewCycle) || created.id === null) throw new Error("create failed")

    expect(await new ReviewCyclePolicyAdapter(context).find(created.id)).not.toBeInstanceOf(Error)

    const opened = await new OpenReviewCycle(reviewPorts(context)).execute({
      session,
      cycleId: created.id,
    })

    expect(opened instanceof ReviewCycle ? opened.status : opened).toBe("open")

    const updated = await new UpdateReviewCycle(reviewPorts(context)).run({
      session,
      cycleId: created.id,
      title: "Open Updated",
      period: "2026-H1",
      dueDate: null,
    })

    expect(updated instanceof ReviewCycle ? updated.title : updated).toBe("Open Updated")

    const closed = await new CloseReviewCycle(reviewPorts(context)).execute({
      session,
      cycleId: created.id,
    })

    expect(closed instanceof ReviewCycle ? closed.status : closed).toBe("closed")

    // 読み出した版から遷移しても、行が既に閉じていれば条件付きUPDATEは0行になる。
    const stale = created.open()

    if (stale === null) throw new Error("open failed")

    expect(await new ReviewCycleRepository(context).updateStatus(stale, "draft")).toBeNull()
  })

  test("deleteWithForms removes a draft cycle with its forms and the guard keeps forms of a cycle opened concurrently", async () => {
    const { context, db } = await createLocalD1Context(local, "delete-guard")
    const repository = new ReviewCycleRepository(context)

    const draft = await seedCycle(context, "draft")
    await seedPendingForm(db, draft.id ?? "")

    expect(await repository.deleteWithForms(draft)).toBeNull()
    expect(await repository.findById(draft.id ?? "")).toBeNull()
    expect(await formCount(db, draft.id ?? "")).toBe(0)

    // draftとして読み出した後に別の要求でopenへ変わった状況を再現する。
    const raced = await seedCycle(context, "open")
    await seedPendingForm(db, raced.id ?? "")
    const staleDraft = new ReviewCycle({
      id: raced.id,
      title: raced.title,
      period: raced.period,
      status: "draft",
      dueDate: raced.dueDate,
    })

    expectApplicationError(
      await repository.deleteWithForms(staleDraft),
      ConflictError,
      "not_deletable",
    )
    expect(await formCount(db, raced.id ?? "")).toBe(1)
  })
})
