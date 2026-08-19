import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { InitialPasswordGenerator } from "@/contexts/system/infrastructure/auth/initial-password.generator"
import { describe, expect, test } from "bun:test"

const TEST_PEPPER = "test-pepper-fixed-value"

describe("generateInitialPassword", () => {
  test("12 文字を返す", () => {
    expect(InitialPasswordGenerator.generate()).toHaveLength(12)
  })

  test("見間違えやすい文字 (0 O 1 l I) を含まない", () => {
    const forbidden = new Set(["0", "O", "1", "l", "I"])

    for (let attempt = 0; attempt < 200; attempt += 1) {
      for (const char of InitialPasswordGenerator.generate()) {
        expect(forbidden.has(char)).toBe(false)
      }
    }
  })

  test("英数字のみで構成される", () => {
    expect(InitialPasswordGenerator.generate()).toMatch(/^[0-9A-Za-z]+$/)
  })

  test("呼び出しごとに独立した値を返す", () => {
    const passwords = new Set<string>()

    for (let attempt = 0; attempt < 50; attempt += 1) {
      passwords.add(InitialPasswordGenerator.generate())
    }

    /**
     * 55 種の文字から 12 桁を 50 回引いて全て衝突しない (現実的に一意)。
     */
    expect(passwords.size).toBe(50)
  })

  test("生成した平文は自身のハッシュで検証できる (発行 API の round-trip)", async () => {
    const password = InitialPasswordGenerator.generate()
    const stored = await PasswordHashService.hash(password, TEST_PEPPER)

    expect(await PasswordHashService.verify(password, stored, TEST_PEPPER)).toBe(true)
  })
})
