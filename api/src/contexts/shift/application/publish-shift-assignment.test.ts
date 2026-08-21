import { describe, expect, test } from "bun:test"
import { PublishShiftAssignment } from "@/contexts/shift/application/publish-shift-assignment"
import { UpdateShiftAssignment } from "@/contexts/shift/application/update-shift-assignment"
import { ConflictError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { ShiftAssignment } from "@/contexts/shift/domain/shift-assignment.entity"
import { ShiftAssignmentRepository } from "@/contexts/shift/infrastructure/shift-assignment.repository"
import { createTestContext } from "@/api/test/support/create-test-context"

async function createAssignment(repository: ShiftAssignmentRepository): Promise<ShiftAssignment> {
  const created = await repository.create(
    ShiftAssignment.create({
      employeeId: 1,
      patternId: null,
      date: "2026-06-01",
      note: null,
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("failed to create assignment")
  }

  return created
}

describe("PublishShiftAssignment", () => {
  test("publishing twice returns already_published on the second call", async () => {
    const { context } = createTestContext()

    const repository = new ShiftAssignmentRepository(context)

    const assignment = await createAssignment(repository)

    if (assignment.id === null) throw new Error("id should not be null")

    const first = await new PublishShiftAssignment(context).run({
      session: makeTestSession("manager"),
      assignmentId: assignment.id,
      publishedAt: "2026-06-01T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ShiftAssignment)

    const second = await new PublishShiftAssignment(context).run({
      session: makeTestSession("manager"),
      assignmentId: assignment.id,
      publishedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(second, ConflictError, "already_published")
  })
})

describe("UpdateShiftAssignment", () => {
  test("updating a published assignment returns already_published", async () => {
    const { context } = createTestContext()

    const repository = new ShiftAssignmentRepository(context)

    const assignment = await createAssignment(repository)

    if (assignment.id === null) throw new Error("id should not be null")

    const published = await repository.markPublished(assignment.id, "2026-06-01T00:00:00.000Z")

    if (published instanceof Error || published === null) {
      throw new Error("markPublished failed")
    }

    const result = await new UpdateShiftAssignment(context).run({
      session: makeTestSession("manager"),
      assignmentId: assignment.id,
      patternCode: null,
      date: "2026-06-05",
      note: "changed",
    })

    expectApplicationError(result, ConflictError, "already_published")
  })
})
