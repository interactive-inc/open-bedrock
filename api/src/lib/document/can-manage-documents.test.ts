import { canManageDocuments } from "@/lib/document/can-manage-documents"
import { canReadDocuments } from "@/lib/document/can-read-documents"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageDocuments", () => {
  test("admin can manage", () => {
    expect(canManageDocuments(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageDocuments(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageDocuments(makeTestSession("unknown"))).toBe(false)
  })
})

describe("canReadDocuments", () => {
  test("admin can read", () => {
    expect(canReadDocuments(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot read", () => {
    expect(canReadDocuments(makeTestSession("member"))).toBe(false)
  })
})
