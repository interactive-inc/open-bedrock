import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateResignation } from "@/contexts/resignation/application/create-resignation"
import { UpdateResignation } from "@/contexts/resignation/application/update-resignation"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import { ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

/** 退職申請Repositoryを型付きfakeにする。永続化の意味はresignation.repository.d1.test.tsで検証する。 */
function createResignationRepository(initial: ReadonlyArray<Resignation> = []) {
  const rows = new Map(initial.map((resignation) => [resignation.id, resignation]))

  return {
    rows,
    findById: async (id: string) => rows.get(id) ?? null,
    findPendingByEmployeeId: async (employeeId: Resignation["employeeId"]) =>
      [...rows.values()].find(
        (resignation) => resignation.employeeId === employeeId && resignation.isModifiable,
      ) ?? null,
    create: async (resignation: Resignation) => {
      rows.set(resignation.id, resignation)
      return resignation
    },
    update: async (resignation: Resignation) => {
      if (rows.get(resignation.id)?.isModifiable !== true) return null
      rows.set(resignation.id, resignation)
      return resignation
    },
  }
}

function requested(employeeId: number): Resignation {
  return Resignation.create({
    employeeId: toWorkforceEmployeeId(employeeId),
    resignationDate: "2026-09-30",
    lastWorkingDate: "2026-09-20",
    reason: "Career change",
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

describe("CreateResignation", () => {
  test("creates a resignation with status requested", async () => {
    const resignationRepository = createResignationRepository()

    const created = await new CreateResignation({ resignationRepository }).run({
      employeeId: toWorkforceEmployeeId(2),
      resignationDate: "2026-10-31",
      lastWorkingDate: null,
      reason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(Resignation)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.lastWorkingDate).toBe(null)
    expect(created.reason).toBe(null)
    expect(resignationRepository.rows.get(created.id)).toBe(created)
  })

  test("rejects a second pending resignation with already_requested", async () => {
    const resignationRepository = createResignationRepository([requested(2)])

    const created = await new CreateResignation({ resignationRepository }).run({
      employeeId: toWorkforceEmployeeId(2),
      resignationDate: "2026-10-31",
      lastWorkingDate: null,
      reason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(created, ConflictError, "already_requested")
  })
})

describe("UpdateResignation", () => {
  test("updates the details for the applicant", async () => {
    const current = requested(5)
    const resignationRepository = createResignationRepository([current])

    const result = await new UpdateResignation({ resignationRepository }).run({
      resignationId: current.id,
      employeeId: toWorkforceEmployeeId(5),
      resignationDate: "2026-11-30",
      lastWorkingDate: "2026-11-20",
      reason: "Relocation",
    })

    expect(result).toBeInstanceOf(Resignation)

    if (result instanceof Error || result instanceof Resignation === false) {
      throw new Error("update failed")
    }

    expect(result.resignationDate).toBe("2026-11-30")
    expect(result.reason).toBe("Relocation")
  })

  test("rejects a non applicant with not_applicant", async () => {
    const current = requested(5)
    const resignationRepository = createResignationRepository([current])

    const result = await new UpdateResignation({ resignationRepository }).run({
      resignationId: current.id,
      employeeId: toWorkforceEmployeeId(6),
      resignationDate: "2026-11-30",
      lastWorkingDate: null,
      reason: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
    expect(resignationRepository.rows.get(current.id)).toBe(current)
  })
})
