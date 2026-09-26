import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Room } from "@/contexts/room/domain/entities/room.entity"
import { RoomReservation } from "@/contexts/room/domain/entities/room-reservation.entity"
import { RoomRepository } from "@/contexts/room/infrastructure/repositories/room.repository"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/repositories/room-reservation.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["room-lifecycle"] })
})

afterAll(async () => {
  await local.dispose()
})

async function countRows(db: D1Database, table: "rooms" | "room_reservations"): Promise<number> {
  const row = await db.prepare(`SELECT count(*) AS count FROM ${table}`).first<{ count: number }>()
  return row?.count ?? -1
}

describe("RoomRepository on local D1", () => {
  test("creates with a UUID id, updates, and deletes the room with its reservations in one batch", async () => {
    const { context, db } = await createLocalD1Context(local, "room-lifecycle")

    const repository = new RoomRepository(context)

    const created = await repository.create({ name: "Room A", capacity: 10, location: "3F" })

    if (!(created instanceof Room)) throw new Error("create failed")

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)

    const updated = await repository.update(
      created.withDetails({ name: "Updated Room", capacity: 20, location: "5F" }),
    )

    if (!(updated instanceof Room)) throw new Error("update failed")

    expect(updated.name).toBe("Updated Room")
    expect(updated.capacity).toBe(20)

    const reservation = RoomReservation.create({
      roomId: created.id,
      reserverId: toWorkforceEmployeeId(testEmployeeId(1)),
      startAt: "2026-06-01T10:00:00.000Z",
      endAt: "2026-06-01T11:00:00.000Z",
      purpose: "Meeting",
    })

    if ("reason" in reservation) throw new Error("invalid reservation")

    expect(
      await new RoomReservationRepository(context).createIfNoOverlap(reservation),
    ).toBeInstanceOf(RoomReservation)
    expect(await countRows(db, "room_reservations")).toBe(1)

    expect(await repository.deleteWithReservations(updated)).toBe(true)
    expect(await countRows(db, "rooms")).toBe(0)
    expect(await countRows(db, "room_reservations")).toBe(0)
    expect(await repository.findById(created.id)).toBeNull()

    expect(await repository.deleteWithReservations(updated)).toBeNull()
  })
})
