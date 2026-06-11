import { canDecideRedemption } from "@/domain/thanks-points/can-decide-redemption"
import { describe, expect, test } from "bun:test"

describe("canDecideRedemption", () => {
  test("hr can decide", () => {
    expect(canDecideRedemption("hr")).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideRedemption("admin")).toBe(true)
  })

  test("manager cannot decide", () => {
    expect(canDecideRedemption("manager")).toBe(false)
  })

  test("member cannot decide", () => {
    expect(canDecideRedemption("member")).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideRedemption("viewer")).toBe(false)
  })
})
