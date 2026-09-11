import { describe, expect, test } from "vite-plus/test"
import { visibleInboxTypes } from "@/lib/inbox/visible-inbox-types"
import { isPathOfDisabledFeature } from "@/lib/feature/is-path-of-disabled-feature"

const permissions = [
  "expense:approve",
  "leave:approve",
  "shift_swap:approve",
  "thanks_redemption:approve",
  "antisocial_check:manage",
]
const pairs = [
  ["expenses", "/inbox/expenses"],
  ["leave", "/inbox/leaves"],
  ["shifts", "/inbox/shift-swaps"],
  ["thanks", "/inbox/thanks-redemptions"],
  ["ringi", "/inbox/ringis"],
  ["antisocial-checks", "/inbox/antisocial-checks"],
]
describe("受信箱の業務機能の有効化", () => {
  for (const pair of pairs) {
    test(`${pair[0]} を無効にすると導線と直接URLの表示が無効になる`, () => {
      const feature = pair[0]!
      const path = pair[1]!
      expect(visibleInboxTypes(permissions, []).some((item) => item.href === path)).toBe(true)
      expect(visibleInboxTypes(permissions, [feature]).some((item) => item.href === path)).toBe(
        false,
      )
      expect(isPathOfDisabledFeature(path, [feature])).toBe(true)
      expect(isPathOfDisabledFeature(path + "/123", [feature])).toBe(true)
      expect(isPathOfDisabledFeature(path + "-other", [feature])).toBe(false)
    })
  }
  test("System申請は業務の無効化に影響されず、技術権限も必要", () => {
    expect(
      visibleInboxTypes(
        permissions,
        pairs.map((pair) => pair[0]!),
      ).map((item) => item.key),
    ).toEqual(["applications"])
    expect(visibleInboxTypes([], []).map((item) => item.key)).toEqual(["applications", "ringis"])
  })
})
