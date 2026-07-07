import { canManageDisciplinaryActions } from "@/lib/disciplinary-action/can-manage-disciplinary-actions"
import { canReadDisciplinaryActions } from "@/lib/disciplinary-action/can-read-disciplinary-actions"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("disciplinary action permissions", () => {
  test("hr can manage and read (非公開の記録を扱う)", () => {
    expect(canManageDisciplinaryActions(makeTestSession("hr"))).toBe(true)

    expect(canReadDisciplinaryActions(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage and read", () => {
    expect(canManageDisciplinaryActions(makeTestSession("admin"))).toBe(true)

    expect(canReadDisciplinaryActions(makeTestSession("admin"))).toBe(true)
  })

  test("manager can neither manage nor read", () => {
    expect(canManageDisciplinaryActions(makeTestSession("manager"))).toBe(false)

    expect(canReadDisciplinaryActions(makeTestSession("manager"))).toBe(false)
  })

  test("member can neither manage nor read (本人でも閲覧不可)", () => {
    expect(canManageDisciplinaryActions(makeTestSession("member"))).toBe(false)

    expect(canReadDisciplinaryActions(makeTestSession("member"))).toBe(false)
  })
})
