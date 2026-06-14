import { LifeEvent } from "@/domain/life-event/life-event.entity"
import { describe, expect, test } from "bun:test"

describe("LifeEvent.create", () => {
  test("builds with UUID id and submitted status", () => {
    const event = LifeEvent.create({
      employeeId: 1,
      eventType: "marriage",
      eventDate: "2026-06-15",
      detail: "届出済み",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(event).toBeInstanceOf(LifeEvent)
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(event.status).toBe("submitted")
    expect(event.employeeId).toBe(1)
    expect(event.eventType).toBe("marriage")
    expect(event.eventDate).toBe("2026-06-15")
    expect(event.detail).toBe("届出済み")
  })
})

describe("LifeEvent.isModifiable", () => {
  test("returns true for submitted status", () => {
    const event = LifeEvent.create({
      employeeId: 1,
      eventType: "marriage",
      eventDate: "2026-06-15",
      detail: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(event.isModifiable).toBe(true)
  })

  test("returns false for non-submitted status", () => {
    const event = new LifeEvent({
      id: crypto.randomUUID(),
      employeeId: 1,
      eventType: "marriage",
      eventDate: "2026-06-15",
      detail: null,
      status: "approved",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(event.isModifiable).toBe(false)
  })
})

describe("LifeEvent.withDetails", () => {
  test("returns new instance with updated fields", () => {
    const event = LifeEvent.create({
      employeeId: 1,
      eventType: "marriage",
      eventDate: "2026-06-15",
      detail: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    const updated = event.withDetails({
      eventType: "childbirth",
      eventDate: "2026-09-01",
      detail: "第一子誕生",
    })

    expect(updated).toBeInstanceOf(LifeEvent)
    expect(updated.eventType).toBe("childbirth")
    expect(updated.eventDate).toBe("2026-09-01")
    expect(updated.detail).toBe("第一子誕生")
    expect(updated.employeeId).toBe(1)
    expect(updated.status).toBe("submitted")
  })
})
