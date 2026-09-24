import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { RentalReservation } from "@/contexts/rental/domain/entities/rental-reservation.entity"
import { CreateRentalReservation } from "@/contexts/rental/application/create-rental-reservation"
import { UpdateRentalReservation } from "@/contexts/rental/application/update-rental-reservation"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

/**
 * レンタル予約Repositoryを型付きfakeにする。重複判定の条件付きSQLは
 * rental-reservation.repository.test.tsが検証するため、ここでは同じ規則を配列で再現するだけにする。
 */
function createReservationRepository(initial: ReadonlyArray<RentalReservation> = []) {
  const rows = new Map(initial.map((reservation) => [reservation.id, reservation]))

  const overlaps = (candidate: RentalReservation) =>
    [...rows.values()].some(
      (row) =>
        row.id !== candidate.id &&
        row.status === "requested" &&
        row.itemName === candidate.itemName &&
        row.startDate <= candidate.endDate &&
        candidate.startDate <= row.endDate,
    )

  return {
    rows,
    findById: async (id: string) => rows.get(id) ?? null,
    createIfNoOverlap: async (reservation: RentalReservation) => {
      if (overlaps(reservation)) return null
      rows.set(reservation.id, reservation)
      return reservation
    },
    updateIfNoOverlap: async (reservation: RentalReservation) => {
      if (rows.get(reservation.id)?.status !== "requested" || overlaps(reservation)) return null
      rows.set(reservation.id, reservation)
      return reservation
    },
  }
}

function projectorReservation(requesterId: number): RentalReservation {
  const reservation = RentalReservation.create({
    requesterId: toWorkforceEmployeeId(requesterId),
    itemName: "projector",
    startDate: "2026-04-01",
    endDate: "2026-04-05",
    purpose: "presentation",
    createdAt: "2026-03-15T09:00:00.000Z",
  })

  if ("reason" in reservation) {
    throw new Error("seed failed")
  }

  return reservation
}

describe("CreateRentalReservation", () => {
  test("creates a reservation", async () => {
    const reservationRepository = createReservationRepository()

    const result = await new CreateRentalReservation({ reservationRepository }).run({
      requesterId: toWorkforceEmployeeId(1),
      itemName: "laptop",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      purpose: null,
      createdAt: "2026-03-15T09:00:00.000Z",
    })

    expect(result).toBeInstanceOf(RentalReservation)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.itemName).toBe("laptop")
    expect(result.status).toBe("requested")
    expect(reservationRepository.rows.get(result.id)).toBe(result)
  })

  test("rejects invalid date range", async () => {
    const reservationRepository = createReservationRepository()

    const result = await new CreateRentalReservation({ reservationRepository }).run({
      requesterId: toWorkforceEmployeeId(1),
      itemName: "laptop",
      startDate: "2026-04-10",
      endDate: "2026-04-01",
      purpose: null,
      createdAt: "2026-03-15T09:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "invalid_date_range")
    expect(reservationRepository.rows.size).toBe(0)
  })

  test("rejects overlapping reservation for the same item", async () => {
    const reservationRepository = createReservationRepository([projectorReservation(1)])

    const result = await new CreateRentalReservation({ reservationRepository }).run({
      requesterId: toWorkforceEmployeeId(2),
      itemName: "projector",
      startDate: "2026-04-03",
      endDate: "2026-04-07",
      purpose: null,
      createdAt: "2026-03-15T10:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "overlapping_reservation")
  })
})

describe("UpdateRentalReservation", () => {
  test("updates the reservation for the requester", async () => {
    const created = projectorReservation(1)
    const reservationRepository = createReservationRepository([created])

    const result = await new UpdateRentalReservation({ reservationRepository }).run({
      reservationId: created.id,
      requesterId: toWorkforceEmployeeId(1),
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: "updated purpose",
    })

    expect(result).toBeInstanceOf(RentalReservation)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.itemName).toBe("monitor")
    expect(result.purpose).toBe("updated purpose")
  })

  test("rejects non-requester with not_requester", async () => {
    const created = projectorReservation(1)
    const reservationRepository = createReservationRepository([created])

    const result = await new UpdateRentalReservation({ reservationRepository }).run({
      reservationId: created.id,
      requesterId: toWorkforceEmployeeId(999),
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
    expect(reservationRepository.rows.get(created.id)).toBe(created)
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const reservationRepository = createReservationRepository()

    const result = await new UpdateRentalReservation({ reservationRepository }).run({
      reservationId: "00000000-0000-0000-0000-000000000000",
      requesterId: toWorkforceEmployeeId(1),
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: null,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})
