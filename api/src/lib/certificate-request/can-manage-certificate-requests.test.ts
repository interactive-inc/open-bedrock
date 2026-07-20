import { canManageCertificateRequests } from "@/lib/certificate-request/can-manage-certificate-requests"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageCertificateRequests", () => {
  test("hr can manage", () => {
    expect(canManageCertificateRequests(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageCertificateRequests(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageCertificateRequests(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageCertificateRequests(makeTestSession("member"))).toBe(false)
  })
})
