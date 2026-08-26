import { ApplicationInternalError } from "@system/application/errors/application-internal-error.error"

export class PepperSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "pepper_secret_missing",
      message: "パスワード機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}
