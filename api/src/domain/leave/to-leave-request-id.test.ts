import { toLeaveRequestId } from "@/domain/leave/to-leave-request-id"
import { describe, expect, test } from "bun:test"

describe("toLeaveRequestId", () => {
  test("valid positive integer returns number", () => {
    expect(toLeaveRequestId("42")).toBe(42)
  })

  test('"1" returns 1', () => {
    expect(toLeaveRequestId("1")).toBe(1)
  })

  test('"0" returns null', () => {
    expect(toLeaveRequestId("0")).toBeNull()
  })

  test("negative returns null", () => {
    expect(toLeaveRequestId("-5")).toBeNull()
  })

  test("non-integer returns null", () => {
    expect(toLeaveRequestId("3.14")).toBeNull()
  })

  test("non-numeric returns null", () => {
    expect(toLeaveRequestId("abc")).toBeNull()
  })
})
