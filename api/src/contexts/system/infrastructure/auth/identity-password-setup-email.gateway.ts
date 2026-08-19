import type { SystemEmailContext } from "@system/infrastructure/configuration/system-context"
import { escapeHtml } from "@/lib/text/escape-html"

type BuildProps = Readonly<{ origin: string; token: string; email: string; senderName: string }>
type SendProps = Readonly<{ to: string; origin: string; token: string }>

export type IdentityPasswordSetupEmailContent = Readonly<{
  subject: string
  text: string
  html: string
}>

export class IdentityPasswordSetupEmailGateway {
  constructor(private readonly c: SystemEmailContext) {}

  static build(props: BuildProps): IdentityPasswordSetupEmailContent {
    const setupLink = `${props.origin}/reset-password?token=${props.token}`
    const loginLink = `${props.origin}/login`
    const subject = `【${props.senderName}】ログイン用メールアドレス設定のご案内`
    const text = `${props.senderName} のログイン用メールアドレスとして登録されました。

ログイン ID (メールアドレス): ${props.email}

以下のリンクから、このメールアドレス用のパスワードを設定してください。

${setupLink}

設定後のログインはこちら: ${loginLink}

このリンクは一定期間で有効期限が切れます。心当たりがない場合はこのメールを破棄してください。`
    const html = `<p>${escapeHtml(props.senderName)} のログイン用メールアドレスとして登録されました。</p>
<p>ログイン ID (メールアドレス): <strong>${escapeHtml(props.email)}</strong></p>
<p>以下のリンクから、このメールアドレス用のパスワードを設定してください。</p>
<p><a href="${setupLink}">${setupLink}</a></p>
<p>設定後のログインはこちら: <a href="${loginLink}">${loginLink}</a></p>
<p>このリンクは一定期間で有効期限が切れます。心当たりがない場合はこのメールを破棄してください。</p>`

    return { subject, text, html }
  }

  async send(props: SendProps): Promise<"sent" | "skipped" | Error> {
    const senderName = this.c.env.EMAIL_SENDER_NAME ?? ""
    const content = IdentityPasswordSetupEmailGateway.build({
      origin: props.origin,
      token: props.token,
      email: props.to,
      senderName,
    })

    if (this.c.env.INVITE_EMAIL_SEND_ENABLED !== "true") {
      console.log(`[identity-password-setup-email] skipped (local dev). to=${props.to}`)
      return "skipped"
    }

    if (this.c.env.EMAIL === undefined || this.c.env.INVITE_EMAIL_FROM === undefined) {
      return new Error("identity_password_setup_email_configuration_missing")
    }

    try {
      await this.c.env.EMAIL.send({
        to: props.to,
        from: { name: senderName, email: this.c.env.INVITE_EMAIL_FROM },
        subject: content.subject,
        text: content.text,
        html: content.html,
      })
      return "sent"
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("identity_password_setup_email_send_failed")
    }
  }
}
