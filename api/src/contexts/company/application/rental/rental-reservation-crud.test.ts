import { describe, expect, test } from "bun:test"
import { RentalReservation } from "@/contexts/company/domain/rental/rental-reservation.entity"
import { CreateRentalReservation } from "@/contexts/company/application/rental/create-rental-reservation"
import { GetRentalReservation } from "@/contexts/company/application/rental/get-rental-reservation"
import { UpdateRentalReservation } from "@/contexts/company/application/rental/update-rental-reservation"
import { CancelRentalReservation } from "@/contexts/company/application/rental/cancel-rental-reservation"
import { ListMyRentalReservations } from "@/contexts/company/application/rental/list-my-rental-reservations"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@/contexts/company/interface/test-helpers/expect-application-error"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import type { Context } from "@/env"

async function seedReservation(context: Context, requesterId: number): Promise<RentalReservation> {
  const result = await new CreateRentalReservation(context).run({
    requesterId: requesterId,
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
    const { context } = createTestContext()

    const result = await new CreateRentalReservation(context).run({
      requesterId: 1,
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
    const { context } = createTestContext()

    const result = await new CreateRentalReservation(context).run({
      requesterId: 1,
      itemName: "laptop",
      startDate: "2026-04-10",
      endDate: "2026-04-01",
      purpose: null,
      createdAt: "2026-03-15T09:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "invalid_date_range")
  })

  test("rejects overlapping reservation for the same item", async () => {
    const { context } = createTestContext()

    await seedReservation(context, 1)

    const result = await new CreateRentalReservation(context).run({
      requesterId: 2,
      itemName: "projector",
      startDate: "2026-04-03",
      endDate: "2026-04-07",
      purpose: null,
      createdAt: "2026-03-15T10:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "overlapping_reservation")
  })
})

describe("GetRentalReservation", () => {
  test("returns the reservation for the requester", async () => {
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new GetRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 1,
    })

    expect(result).toBeInstanceOf(RentalReservation)
  })

  test("rejects non-requester with not_requester", async () => {
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new GetRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetRentalReservation(context).run({
      reservationId: "00000000-0000-0000-0000-000000000000",
      requesterId: 1,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})

describe("UpdateRentalReservation", () => {
  test("updates the reservation for the requester", async () => {
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new UpdateRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 1,
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
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new UpdateRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 999,
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateRentalReservation(context).run({
      reservationId: "00000000-0000-0000-0000-000000000000",
      requesterId: 1,
      itemName: "monitor",
      startDate: "2026-04-02",
      endDate: "2026-04-06",
      purpose: null,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})

describe("CancelRentalReservation", () => {
  test("cancels the reservation for the requester", async () => {
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new CancelRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 1,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects non-requester with not_requester", async () => {
    const { context } = createTestContext()

    const created = await seedReservation(context, 1)

    const result = await new CancelRentalReservation(context).run({
      reservationId: created.id,
      requesterId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const { context } = createTestContext()

    const result = await new CancelRentalReservation(context).run({
      reservationId: "00000000-0000-0000-0000-000000000000",
      requesterId: 1,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})

describe("ListMyRentalReservations", () => {
  test("returns reservations for the requester", async () => {
    const { context } = createTestContext()

    await seedReservation(context, 1)

    const result = await new ListMyRentalReservations(context).run({
      requesterId: 1,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
  })

  test("returns empty list for a different requester", async () => {
    const { context } = createTestContext()

    await seedReservation(context, 1)

    const result = await new ListMyRentalReservations(context).run({
      requesterId: 999,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(0)
  })
})
