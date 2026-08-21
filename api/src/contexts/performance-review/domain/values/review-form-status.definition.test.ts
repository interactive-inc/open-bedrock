import { toFormStatus } from "@/contexts/performance-review/domain/values/review-form-status.definition"
import { describe, expect, test } from "bun:test"

describe("toFormStatus", () => {
  test("submitted returns submitted", () => {
    expect(toFormStatus("submitted")).toBe("submitted")
  })

  test("pending returns pending", () => {
    expect(toFormStatus("pending")).toBe("pending")
  })

  test("unknown returns pending", () => {
    expect(toFormStatus("draft")).toBe("pending")
  })
})
