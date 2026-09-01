import { describe, expect, test } from "vite-plus/test"

import { resolveLoginDefaults } from "@/lib/auth/resolve-login-defaults"

describe("resolveLoginDefaults", () => {
  test("developmentではローカルseedの資格情報を返す", () => {
    expect(resolveLoginDefaults("development")).toEqual({
      email: "you+e001@example.com",
      password: "password",
    })
  })

  test("productionでは何も入力しない", () => {
    expect(resolveLoginDefaults("production")).toBeNull()
  })

  test("testでは何も入力しない", () => {
    expect(resolveLoginDefaults("test")).toBeNull()
  })

  test("未設定では何も入力しない", () => {
    expect(resolveLoginDefaults(undefined)).toBeNull()
  })
})
