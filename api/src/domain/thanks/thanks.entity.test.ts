import { Thanks } from "@/domain/thanks/thanks.entity"
import { describe, expect, test } from "bun:test"

describe("Thanks.create", () => {
  test("builds a thanks with the given points", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "ありがとう",
      points: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Thanks)

    if (thanks instanceof Error) {
      throw thanks
    }

    expect(thanks.id).toBe(null)
    expect(thanks.points).toBe(0)
    expect(thanks.message).toBe("ありがとう")
  })

  test("keeps the attached points", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "ありがとう",
      points: 30,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (thanks instanceof Error) {
      throw thanks
    }

    expect(thanks.points).toBe(30)
  })

  test("rejects negative points", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "ありがとう",
      points: -1,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Error)
  })

  test("rejects sending thanks to yourself", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 4,
      message: "ありがとう",
      points: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Error)
  })

  test("rejects an empty message", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "   ",
      points: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Error)
  })

  test("accepts a message of exactly 1000 characters", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "あ".repeat(1000),
      points: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Thanks)
  })

  test("rejects a message of 1001 characters", () => {
    const thanks = Thanks.create({
      senderEmployeeId: 4,
      recipientEmployeeId: 5,
      message: "あ".repeat(1001),
      points: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(thanks).toBeInstanceOf(Error)
  })
})
