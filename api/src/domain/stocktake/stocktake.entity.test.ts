import { Stocktake } from "@/domain/stocktake/stocktake.entity"
import { describe, expect, test } from "bun:test"

describe("Stocktake.create", () => {
  test("builds with open status and null closedAt", () => {
    const stocktake = Stocktake.create({
      name: "上期 棚卸し",
      targetDate: "2026-04-01",
      createdAt: "2026-04-01T09:00:00Z",
    })

    expect(stocktake).toBeInstanceOf(Stocktake)
    expect(stocktake.name).toBe("上期 棚卸し")
    expect(stocktake.targetDate).toBe("2026-04-01")
    expect(stocktake.status).toBe("open")
    expect(stocktake.closedAt).toBeNull()
    expect(stocktake.id.length).toBeGreaterThan(0)
  })
})

describe("Stocktake.withClosed", () => {
  test("returns new Stocktake in closed status recording closedAt", () => {
    const stocktake = Stocktake.create({
      name: "上期 棚卸し",
      targetDate: "2026-04-01",
      createdAt: "2026-04-01T09:00:00Z",
    })

    const closed = stocktake.withClosed("2026-04-05T18:00:00Z")

    expect(closed).toBeInstanceOf(Stocktake)
    expect(closed.status).toBe("closed")
    expect(closed.closedAt).toBe("2026-04-05T18:00:00Z")
    expect(closed.id).toBe(stocktake.id)
  })
})
