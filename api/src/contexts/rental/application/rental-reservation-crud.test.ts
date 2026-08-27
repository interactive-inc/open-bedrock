import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { RentalReservation } from "@/contexts/rental/domain/entities/rental-reservation.entity"
import { CreateRentalReservation } from "@/contexts/rental/application/create-rental-reservation"
import { UpdateRentalReservation } from "@/contexts/rental/application/update-rental-reservation"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { createTestContext } from "@tests/api/support/create-test-context"
import type { Context } from "@/env"

async function seedReservation(context: Context, requesterId: number): Promise<RentalReservation> {
  const result = await new CreateRentalReservation(context).run({
    requesterId: toWorkforceEmployeeId(requesterId),
    itemName: "projector",
    startDate: "2026-04-01",
    endDate: "2026-04-05",
    purpose: "presentation",
    createdAt: "2026-03-15T09:00:00.000Z",
  })

  if (result instanceof Error) {
    throw new Error("seed failed")
  }

  return result
}

describe("CreateRentalReservation", () => {
  test("creates a reservation", async () => {
    const { context } = await createTestContext()

    const result = await new CreateRentalReservation(context).run({
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
  })

  test("rejects invalid date range", async () => {
    const { context } = await createTestContext()

    const result = await new CreateRentalReservation(context).run({
      requesterId: toWorkforceEmployeeId(1),
      itemName: "laptop",
      startDate: "2026-04-10",
      endDate: "2026-04-01",
      purpose: null,
      createdAt: "2026-03-15T09:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "invalid_date_range")
  })

  test("rejects overlapping reservation for the same item", async () => {
    const { context } = await createTestContext()

    await seedReservation(context, 1)

    const result = await new CreateRentalReservation(context).run({
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

describe("GetRentalReservation", () => {})

describe("UpdateRentalReservation", () => {
  test("updates the reservation for the requester", async () => {
    const { context } = await createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new UpdateRentalReservation(context).run({
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
    const { context } = await createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new UpdateRentalReservation(context).run({
      reservationId: created.id,
      requesterId: toWorkforceEmployeeId(999),
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new UpdateRentalReservation(context).run({
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

describe("CancelRentalReservation", () => {})

describe("ListMyRentalReservations", () => {})
