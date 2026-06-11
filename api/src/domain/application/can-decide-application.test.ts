import { canDecideApplication } from "@/domain/application/can-decide-application"
import { describe, expect, test } from "bun:test"

describe("canDecideApplication", () => {
  test("manager can decide", () => {
    expect(canDecideApplication("manager")).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideApplication("hr")).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideApplication("admin")).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideApplication("member")).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideApplication("viewer")).toBe(false)
  })
})
