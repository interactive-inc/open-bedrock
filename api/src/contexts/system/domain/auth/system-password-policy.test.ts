import { validateSystemPassword } from "@system/domain/auth/system-password-policy"
import { expect, test } from "bun:test"

test("System passwordは12文字以上200文字以下のパスフレーズを受理する", () => {
  expect(validateSystemPassword("correct horse battery staple")).toBeNull()
  expect(validateSystemPassword("a".repeat(12))).toBeNull()
  expect(validateSystemPassword("a".repeat(200))).toBeNull()
})

test("System passwordは短すぎる値とhash資源を浪費する長さを拒否する", () => {
  expect(validateSystemPassword("a".repeat(11))).toBe("password_too_short")
  expect(validateSystemPassword("a".repeat(201))).toBe("password_too_long")
})
