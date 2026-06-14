import { Room } from "@/domain/room/room.entity"
import { describe, expect, test } from "bun:test"

describe("Room.fromRow", () => {
  test("builds a Room from row data", () => {
    const room = Room.fromRow({
      id: 1,
      name: "会議室A",
      capacity: 10,
      location: "3F",
    })

    expect(room).toBeInstanceOf(Room)
    expect(room.id).toBe(1)
    expect(room.name).toBe("会議室A")
    expect(room.capacity).toBe(10)
    expect(room.location).toBe("3F")
  })

  test("builds a Room with null location", () => {
    const room = Room.fromRow({
      id: 2,
      name: "会議室B",
      capacity: 4,
      location: null,
    })

    expect(room).toBeInstanceOf(Room)
    expect(room.location).toBeNull()
  })
})

describe("Room.withDetails", () => {
  test("returns new Room with changed details", () => {
    const room = Room.fromRow({
      id: 1,
      name: "会議室A",
      capacity: 10,
      location: "3F",
    })

    const updated = room.withDetails({
      name: "大会議室",
      capacity: 20,
      location: "5F",
    })

    expect(updated).toBeInstanceOf(Room)
    expect(updated.id).toBe(1)
    expect(updated.name).toBe("大会議室")
    expect(updated.capacity).toBe(20)
    expect(updated.location).toBe("5F")
  })
})
