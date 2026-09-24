import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/repositories/shift-assignment.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "create-then-findbyid-round-trips-the-shift",
      "markpublished-publishes-an-unpublished",
      "markpublished-returns-null-for-an-already",
      "update-returns-null-and-leaves-a-published",
      "update-succeeds-for-an-unpublished-assignment",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("ShiftAssignmentRepository", () => {
  test("create then findById round-trips the shift assignment", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbyid-round-trips-the-shift",
    )

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: toWorkforceEmployeeId(1),
        patternId: null,
        date: "2026-05-31",
        note: null,
      }),
    )

    expect(created).toBeInstanceOf(ShiftAssignment)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(ShiftAssignment)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.date).toBe("2026-05-31")
    expect(found.publishedAt).toBeNull()
  })

  test("markPublished publishes an unpublished assignment", async () => {
    const { context } = await createLocalD1Context(local, "markpublished-publishes-an-unpublished")

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: toWorkforceEmployeeId(1),
        patternId: null,
        date: "2026-06-01",
        note: null,
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const published = await repository.markPublished(created.id, "2026-06-01T00:00:00.000Z")

    expect(published).toBeInstanceOf(ShiftAssignment)

    if (published instanceof Error || published === null) {
      throw new Error("markPublished failed")
    }

    expect(published.publishedAt).toBe("2026-06-01T00:00:00.000Z")
  })

  test("markPublished returns null for an already published assignment", async () => {
    const { context } = await createLocalD1Context(
      local,
      "markpublished-returns-null-for-an-already",
    )

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: toWorkforceEmployeeId(1),
        patternId: null,
        date: "2026-06-02",
        note: null,
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const first = await repository.markPublished(created.id, "2026-06-02T00:00:00.000Z")

    if (first instanceof Error || first === null) {
      throw new Error("first markPublished failed")
    }

    const second = await repository.markPublished(created.id, "2026-06-03T00:00:00.000Z")

    expect(second).toBeNull()

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.publishedAt).toBe("2026-06-02T00:00:00.000Z")
  })

  test("update returns null and leaves a published assignment unchanged", async () => {
    const { context } = await createLocalD1Context(
      local,
      "update-returns-null-and-leaves-a-published",
    )

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: toWorkforceEmployeeId(1),
        patternId: null,
        date: "2026-06-04",
        note: "original",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const published = await repository.markPublished(created.id, "2026-06-04T00:00:00.000Z")

    if (published instanceof Error || published === null) {
      throw new Error("markPublished failed")
    }

    const updated = await repository.update(
      published.withDetails({ patternId: null, date: "2026-06-05", note: "changed" }),
    )

    expect(updated).toBeNull()

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.date).toBe("2026-06-04")
    expect(found.note).toBe("original")
    expect(found.publishedAt).toBe("2026-06-04T00:00:00.000Z")
  })

  test("update succeeds for an unpublished assignment and keeps publishedAt null", async () => {
    const { context } = await createLocalD1Context(
      local,
      "update-succeeds-for-an-unpublished-assignment",
    )

    const repository = new ShiftAssignmentRepository(context)

    const created = await repository.create(
      ShiftAssignment.create({
        employeeId: toWorkforceEmployeeId(1),
        patternId: null,
        date: "2026-06-06",
        note: "original",
      }),
    )

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const updated = await repository.update(
      created.withDetails({ patternId: null, date: "2026-06-07", note: "changed" }),
    )

    expect(updated).toBeInstanceOf(ShiftAssignment)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.date).toBe("2026-06-07")
    expect(updated.note).toBe("changed")
    expect(updated.publishedAt).toBeNull()
  })
})
