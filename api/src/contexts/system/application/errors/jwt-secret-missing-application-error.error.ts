import { ApplicationInternalError } from "@system/application/errors/application-internal-error.error"

export class JwtSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "jwt_secret_missing",
      message: "ログイン機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}
