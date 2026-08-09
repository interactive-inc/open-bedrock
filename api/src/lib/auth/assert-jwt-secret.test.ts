import { describe, expect, test } from "bun:test"

import { assertJwtSecret } from "@/lib/auth/assert-jwt-secret"
import { UnavailableError } from "@/lib/errors"

describe("assertJwtSecret", () => {
  test("十分な長さの秘密値を通す", () => {
    expect(() => assertJwtSecret("a-sufficiently-long-secret")).not.toThrow()
  })

  test("未設定を拒否する", () => {
    expect(() => assertJwtSecret("")).toThrow(UnavailableError)
  })

  test("空白だけの値を拒否する", () => {
    expect(() => assertJwtSecret("      ")).toThrow(UnavailableError)
  })

  test("公開リポジトリが配る例示値を拒否する", () => {
    expect(() => assertJwtSecret("local-dev-secret-change-me")).toThrow(UnavailableError)
  })

  test("接尾辞が -change-me なら長さが足りていても拒否する", () => {
    expect(() => assertJwtSecret("something-much-longer-change-me")).toThrow(UnavailableError)
  })

  test("16文字未満を拒否する", () => {
    expect(() => assertJwtSecret("short-secret")).toThrow(UnavailableError)
  })

  test("エラーに秘密値そのものを含めない", () => {
    const secret = "local-dev-secret-change-me"

    try {
      assertJwtSecret(secret)
      throw new Error("assertJwtSecret should have thrown")
    } catch (caught) {
      expect(caught instanceof UnavailableError).toBe(true)
      expect(caught instanceof Error ? caught.message : "").not.toContain(secret)
    }
  })
})
