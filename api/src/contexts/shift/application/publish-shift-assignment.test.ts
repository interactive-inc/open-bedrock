import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { PublishShiftAssignment } from "@/contexts/shift/application/publish-shift-assignment"
import { UpdateShiftAssignment } from "@/contexts/shift/application/update-shift-assignment"
import { ConflictError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { ShiftAssignment } from "@/contexts/shift/domain/entities/shift-assignment.entity"

/**
 * 割当Repositoryの型付きfake。未公開の割当だけを条件付きで更新する契約は
 * shift-assignment.repository.test.ts がDB上で検証する。
 */
function createAssignmentRepository(initial: ShiftAssignment) {
  const assignments = new Map<string, ShiftAssignment>([
    ["01900024-0000-7000-8000-000000000001", initial],
  ])

  return {
    findById: async (id: string) => assignments.get(id) ?? null,
    markPublished: async (id: string, publishedAt: string) => {
      const current = assignments.get(id)
      if (current === undefined || current.publishedAt !== null) return null
      const published = current.withPublished(publishedAt)
      assignments.set(id, published)
      return published
    },
    update: async (assignment: ShiftAssignment) => {
      if (assignment.id === null) return null
      const current = assignments.get(assignment.id)
      if (current === undefined || current.publishedAt !== null) return null
      assignments.set(assignment.id, assignment)
      return assignment
    },
  }
}

function draftAssignment(): ShiftAssignment {
  return new ShiftAssignment({
    id: "01900024-0000-7000-8000-000000000001",
    employeeId: toWorkforceEmployeeId(1),
    patternId: null,
    date: "2026-06-01",
    note: null,
    publishedAt: null,
  })
}

describe("PublishShiftAssignment", () => {
  test("publishing twice returns already_published on the second call", async () => {
    const assignmentRepository = createAssignmentRepository(draftAssignment())

    const publish = new PublishShiftAssignment({ assignmentRepository })

    const first = await publish.run({
      session: makeTestSession("manager"),
      assignmentId: "01900024-0000-7000-8000-000000000001",
      publishedAt: "2026-06-01T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ShiftAssignment)

    const second = await publish.run({
      session: makeTestSession("manager"),
      assignmentId: "01900024-0000-7000-8000-000000000001",
      publishedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(second, ConflictError, "already_published")
  })
})

describe("UpdateShiftAssignment", () => {
  test("updating a published assignment returns already_published", async () => {
    const assignmentRepository = createAssignmentRepository(
      draftAssignment().withPublished("2026-06-01T00:00:00.000Z"),
    )

    const result = await new UpdateShiftAssignment({
      assignmentRepository,
      patternRepository: { findByCode: async () => null },
    }).run({
      session: makeTestSession("manager"),
      assignmentId: "01900024-0000-7000-8000-000000000001",
      patternCode: null,
      date: "2026-06-05",
      note: "changed",
    })

    expectApplicationError(result, ConflictError, "already_published")
  })
})
