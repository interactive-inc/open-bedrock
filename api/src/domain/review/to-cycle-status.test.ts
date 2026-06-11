import { toCycleStatus } from "@/domain/review/to-cycle-status"
import { describe, expect, test } from "bun:test"

describe("toCycleStatus", () => {
  test("open returns open", () => {
    expect(toCycleStatus("open")).toBe("open")
  })

  test("closed returns closed", () => {
    expect(toCycleStatus("closed")).toBe("closed")
  })

  test("unknown returns draft", () => {
    expect(toCycleStatus("archived")).toBe("draft")
  })

  test("empty string returns draft", () => {
    expect(toCycleStatus("")).toBe("draft")
  })
})
