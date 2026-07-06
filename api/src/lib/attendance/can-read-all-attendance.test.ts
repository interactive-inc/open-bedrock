import { canReadAllAttendance } from "@/lib/attendance/can-read-all-attendance"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canReadAllAttendance", () => {
  test("manager can read all", () => {
    expect(canReadAllAttendance(makeTestSession("manager"))).toBe(true)
  })

  test("hr can read all", () => {
    expect(canReadAllAttendance(makeTestSession("hr"))).toBe(true)
  })

  test("admin can read all", () => {
    expect(canReadAllAttendance(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot read all", () => {
    expect(canReadAllAttendance(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot read all", () => {
    expect(canReadAllAttendance(makeTestSession("viewer"))).toBe(false)
  })
})
