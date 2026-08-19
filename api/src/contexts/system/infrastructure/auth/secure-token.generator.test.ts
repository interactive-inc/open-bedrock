import { describe, expect, test } from "bun:test"
import { SecureTokenGenerator } from "@/contexts/system/infrastructure/auth/secure-token.generator"

describe("SecureTokenGenerator", () => {
  test("32バイトの乱数を64文字の小文字16進数で返す", () => {
    expect(SecureTokenGenerator.generate()).toMatch(/^[0-9a-f]{64}$/)
  })

  test("連続生成したトークンは一致しない", () => {
    const tokens = new Set(Array.from({ length: 32 }, () => SecureTokenGenerator.generate()))
    expect(tokens.size).toBe(32)
  })
})
