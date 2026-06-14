import { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import { describe, expect, test } from "bun:test"

describe("ThanksReward.create", () => {
  test("valid input builds with null id and isActive true", () => {
    const reward = ThanksReward.create({
      name: "Coffee Voucher",
      pointCost: 100,
      stock: 50,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (reward instanceof Error) {
      throw reward
    }

    expect(reward).toBeInstanceOf(ThanksReward)
    expect(reward.id).toBe(null)
    expect(reward.isActive).toBe(true)
    expect(reward.name).toBe("Coffee Voucher")
  })

  test("empty name returns Error", () => {
    const reward = ThanksReward.create({
      name: "",
      pointCost: 100,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reward).toBeInstanceOf(Error)
  })

  test("name over 200 chars returns Error", () => {
    const longName = "a".repeat(201)

    const reward = ThanksReward.create({
      name: longName,
      pointCost: 100,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reward).toBeInstanceOf(Error)
  })

  test("0 pointCost returns Error", () => {
    const reward = ThanksReward.create({
      name: "Gift Card",
      pointCost: 0,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reward).toBeInstanceOf(Error)
  })

  test("negative pointCost returns Error", () => {
    const reward = ThanksReward.create({
      name: "Gift Card",
      pointCost: -10,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reward).toBeInstanceOf(Error)
  })

  test("negative stock returns Error", () => {
    const reward = ThanksReward.create({
      name: "Gift Card",
      pointCost: 100,
      stock: -1,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reward).toBeInstanceOf(Error)
  })
})

describe("ThanksReward.withActive", () => {
  test("returns new with changed isActive", () => {
    const reward = ThanksReward.create({
      name: "Coffee Voucher",
      pointCost: 100,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (reward instanceof Error) {
      throw reward
    }

    const deactivated = reward.withActive(false)

    expect(deactivated.isActive).toBe(false)
    expect(deactivated.name).toBe("Coffee Voucher")
  })
})
