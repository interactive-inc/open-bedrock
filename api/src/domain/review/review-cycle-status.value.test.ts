import { toReviewCycleStatus } from "@/domain/review/review-cycle-status.value"
import { describe, expect, test } from "bun:test"

describe("toReviewCycleStatus", () => {
  test("open returns open", () => {
    expect(toReviewCycleStatus("open")).toBe("open")
  })

  test("closed returns closed", () => {
    expect(toReviewCycleStatus("closed")).toBe("closed")
  })

  test("unknown returns draft", () => {
    expect(toReviewCycleStatus("archived")).toBe("draft")
  })

  test("empty string returns draft", () => {
    expect(toReviewCycleStatus("")).toBe("draft")
  })
})
