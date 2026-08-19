import { expect, test } from "bun:test"
import { IdentityPasswordSetupEmailGateway } from "@/contexts/system/infrastructure/auth/identity-password-setup-email.gateway"

test("追加メール用のパスワード設定リンクとログイン ID を組み立てる", () => {
  const content = IdentityPasswordSetupEmailGateway.build({
    origin: "https://identity.example.test",
    token: "setup-token",
    email: "user@example.com",
    senderName: "System",
  })

  expect(content.subject).toContain("ログイン用メールアドレス設定")
  expect(content.text).toContain("user@example.com")
  expect(content.text).toContain("https://identity.example.test/reset-password?token=setup-token")
  expect(content.html).toContain("<strong>user@example.com</strong>")
})

test("メールアドレスを HTML エスケープする", () => {
  const content = IdentityPasswordSetupEmailGateway.build({
    origin: "https://identity.example.test",
    token: "setup-token",
    email: '"><script>alert(1)</script>@example.com',
    senderName: "System",
  })

  expect(content.html).not.toContain("<script>")
  expect(content.html).toContain("&lt;script&gt;")
})
