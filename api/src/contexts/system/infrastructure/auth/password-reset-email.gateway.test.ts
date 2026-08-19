import { describe, expect, test } from "bun:test"
import { PasswordResetEmailGateway } from "@/contexts/system/infrastructure/auth/password-reset-email.gateway"

describe("buildPasswordResetEmail", () => {
  test("再設定リンクに origin とトークンを埋め込む", () => {
    const content = PasswordResetEmailGateway.build({
      origin: "https://identity.example.test",
      token: "abc123",
      senderName: "System",
    })

    expect(content.text).toContain("https://identity.example.test/reset-password?token=abc123")
    expect(content.html).toContain("https://identity.example.test/reset-password?token=abc123")
  })
})
