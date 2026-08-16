import { RentalReservation } from "@/contexts/rental/domain/rental-reservation.entity"
import { RentalReservationRepository } from "@/contexts/rental/infrastructure/rental-reservation-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("RentalReservationRepository", () => {
  test("create then findById round-trips the reservation", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: "Client presentation",
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.create(reservation)

    expect(created).toBeInstanceOf(RentalReservation)

    if (created instanceof Error) {
      throw created
    }

    const found = await repository.findById(reservation.id)

    expect(found).toBeInstanceOf(RentalReservation)

    if (found instanceof Error || found === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(found.id).toBe(reservation.id)
    expect(found.requesterId).toBe(1)
    expect(found.itemName).toBe("Projector")
    expect(found.startDate).toBe("2026-06-10")
    expect(found.endDate).toBe("2026-06-12")
    expect(found.purpose).toBe("Client presentation")
    expect(found.status).toBe("requested")
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const found = await repository.findById("ffffffff-ffff-ffff-ffff-ffffffffffff")

    expect(found).toBeNull()
  })

  test("findByRequesterId returns only the requester's reservations", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const r1 = RentalReservation.create({
      requesterId: 1,
      itemName: "Laptop",
      startDate: "2026-06-15",
      endDate: "2026-06-20",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    const r2 = RentalReservation.create({
      requesterId: 2,
      itemName: "Camera",
      startDate: "2026-06-18",
      endDate: "2026-06-19",
      purpose: "Event recording",
      createdAt: "2026-06-01T00:00:00Z",
    })

    const r3 = RentalReservation.create({
      requesterId: 1,
      itemName: "Monitor",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: "Remote work",
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (
      !(r1 instanceof RentalReservation) ||
      !(r2 instanceof RentalReservation) ||
      !(r3 instanceof RentalReservation)
    ) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(r1)
    await repository.create(r2)
    await repository.create(r3)

    const result = await repository.findByRequesterId({ requesterId: 1, limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(2)

    // startDate 昇順で返るため r3 (06-10) が先、r1 (06-15) が後
    expect(result[0]?.itemName).toBe("Monitor")
    expect(result[1]?.itemName).toBe("Laptop")
  })

  test("findByRequesterId returns empty array when no reservations exist", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const result = await repository.findByRequesterId({ requesterId: 9999, limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(0)
  })

  test("update succeeds when status is requested", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: "Client presentation",
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(reservation)

    const withDetails = reservation.withDetails({
      itemName: "Large Monitor",
      startDate: "2026-06-15",
      endDate: "2026-06-20",
    })

    if (!(withDetails instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range in withDetails")
    }

    const updated = withDetails.withPurpose("Remote work")

    const result = await repository.update(updated)

    expect(result).toBeInstanceOf(RentalReservation)

    if (result instanceof Error || result === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(result.id).toBe(reservation.id)
    expect(result.itemName).toBe("Large Monitor")
    expect(result.startDate).toBe("2026-06-15")
    expect(result.endDate).toBe("2026-06-20")
    expect(result.purpose).toBe("Remote work")
  })

  test("update returns null when status is not requested", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "rental_reservations", [
      {
        id: "20000000-0000-0000-0000-000000000001",
        requester_id: 1,
        item_name: "Projector",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
        purpose: "Client presentation",
        status: "approved",
        created_at: "2026-06-01T00:00:00Z",
      },
    ])

    const repository = new RentalReservationRepository(context)

    const target = new RentalReservation({
      id: "20000000-0000-0000-0000-000000000001",
      requesterId: 1,
      itemName: "Updated Item",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      purpose: "New purpose",
      status: "requested",
      createdAt: "2026-06-01T00:00:00Z",
    })

    const result = await repository.update(target)

    expect(result).toBeNull()
  })

  test("delete removes the reservation when status is requested", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Camera",
      startDate: "2026-06-18",
      endDate: "2026-06-19",
      purpose: "Event recording",
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(reservation)

    const deleted = await repository.delete(reservation.id)

    expect(deleted).toBe(true)

    const found = await repository.findById(reservation.id)

    expect(found).toBeNull()
  })

  test("delete does not remove when status is not requested", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "rental_reservations", [
      {
        id: "30000000-0000-0000-0000-000000000001",
        requester_id: 1,
        item_name: "Projector",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
        purpose: "Client presentation",
        status: "approved",
        created_at: "2026-06-01T00:00:00Z",
      },
    ])

    const repository = new RentalReservationRepository(context)

    const deleted = await repository.delete("30000000-0000-0000-0000-000000000001")

    expect(deleted).toBeNull()

    const row = await db
      .prepare("SELECT id FROM rental_reservations WHERE id = ?")
      .bind("30000000-0000-0000-0000-000000000001")
      .first()

    expect(row).not.toBeNull()
  })

  test("create preserves null purpose", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Laptop",
      startDate: "2026-06-15",
      endDate: "2026-06-20",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.create(reservation)

    if (created instanceof Error) {
      throw created
    }

    const found = await repository.findById(reservation.id)

    if (found instanceof Error || found === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(found.purpose).toBeNull()
  })

  test("findOverlapping returns reservations with same itemName and overlapping dates", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    const overlapping = await repository.findOverlapping({
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
    })

    if (overlapping instanceof Error) {
      throw overlapping
    }

    expect(overlapping.length).toBe(1)
    expect(overlapping[0]?.id).toBe(existing.id)
  })

  test("findOverlapping excludes the reservation by excludeId", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    const overlapping = await repository.findOverlapping({
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
      excludeId: existing.id,
    })

    if (overlapping instanceof Error) {
      throw overlapping
    }

    expect(overlapping.length).toBe(0)
  })

  test("findOverlapping returns empty when different itemName", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    const overlapping = await repository.findOverlapping({
      itemName: "Camera",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
    })

    if (overlapping instanceof Error) {
      throw overlapping
    }

    expect(overlapping.length).toBe(0)
  })

  test("createIfNoOverlap creates the reservation when no overlap exists", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: "Client presentation",
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.createIfNoOverlap(reservation)

    expect(created).toBeInstanceOf(RentalReservation)

    if (created instanceof Error || created === null) {
      throw new Error("expected reservation but got null or Error")
    }

    const found = await repository.findById(reservation.id)

    expect(found).toBeInstanceOf(RentalReservation)
  })

  test("createIfNoOverlap returns null when an overlapping requested reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    const overlapping = RentalReservation.create({
      requesterId: 2,
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
      purpose: null,
      createdAt: "2026-06-02T00:00:00Z",
    })

    if (!(overlapping instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.createIfNoOverlap(overlapping)

    expect(created).toBeNull()

    const found = await repository.findById(overlapping.id)

    expect(found).toBeNull()
  })

  test("createIfNoOverlap succeeds for the same period when itemName differs", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    const other = RentalReservation.create({
      requesterId: 2,
      itemName: "Camera",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-02T00:00:00Z",
    })

    if (!(other instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.createIfNoOverlap(other)

    expect(created).toBeInstanceOf(RentalReservation)
  })

  test("createIfNoOverlap ignores non-requested existing rows", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "rental_reservations", [
      {
        id: "40000000-0000-0000-0000-000000000001",
        requester_id: 1,
        item_name: "Projector",
        start_date: "2026-06-10",
        end_date: "2026-06-15",
        purpose: null,
        status: "rejected",
        created_at: "2026-06-01T00:00:00Z",
      },
    ])

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 2,
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
      purpose: null,
      createdAt: "2026-06-02T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.createIfNoOverlap(reservation)

    expect(created).toBeInstanceOf(RentalReservation)
  })

  test("createIfNoOverlap treats touching boundaries as overlap (inclusive)", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const existing = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(existing instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(existing)

    // 新予約の start_date が既存の end_date と一致する境界は inclusive 比較で重複扱い。
    const touching = RentalReservation.create({
      requesterId: 2,
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-02T00:00:00Z",
    })

    if (!(touching instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const created = await repository.createIfNoOverlap(touching)

    expect(created).toBeNull()
  })

  test("updateIfNoOverlap returns null when it overlaps another reservation", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const a = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    const b = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-20",
      endDate: "2026-06-25",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(a instanceof RentalReservation) || !(b instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(a)
    await repository.create(b)

    // b を a と重なる期間に変更しようとすると重複で null。
    const conflicting = b.withDetails({
      itemName: "Projector",
      startDate: "2026-06-11",
      endDate: "2026-06-15",
    })

    if (!(conflicting instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const result = await repository.updateIfNoOverlap(conflicting)

    expect(result).toBeNull()
  })

  test("updateIfNoOverlap succeeds when only the reservation itself overlaps", async () => {
    const { context } = createTestContext()

    const repository = new RentalReservationRepository(context)

    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      purpose: null,
      createdAt: "2026-06-01T00:00:00Z",
    })

    if (!(reservation instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    await repository.create(reservation)

    // 自身としか重ならない変更は自身を除外するため成功する。
    const changed = reservation.withDetails({
      itemName: "Projector",
      startDate: "2026-06-12",
      endDate: "2026-06-18",
    })

    if (!(changed instanceof RentalReservation)) {
      throw new Error("unexpected invalid_date_range")
    }

    const result = await repository.updateIfNoOverlap(changed)

    expect(result).toBeInstanceOf(RentalReservation)

    if (result instanceof Error || result === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(result.startDate).toBe("2026-06-12")
    expect(result.endDate).toBe("2026-06-18")
  })

  test("updateIfNoOverlap returns null when the row status is not requested", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "rental_reservations", [
      {
        id: "50000000-0000-0000-0000-000000000001",
        requester_id: 1,
        item_name: "Projector",
        start_date: "2026-06-10",
        end_date: "2026-06-12",
        purpose: null,
        status: "approved",
        created_at: "2026-06-01T00:00:00Z",
      },
    ])

    const repository = new RentalReservationRepository(context)

    const target = new RentalReservation({
      id: "50000000-0000-0000-0000-000000000001",
      requesterId: 1,
      itemName: "Updated Item",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      purpose: "New purpose",
      status: "requested",
      createdAt: "2026-06-01T00:00:00Z",
    })

    const result = await repository.updateIfNoOverlap(target)

    expect(result).toBeNull()
  })
})
