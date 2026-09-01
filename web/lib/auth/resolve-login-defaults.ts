export type LoginDefaults = {
  email: string
  password: string
}

/**
 * ローカル開発の seed アカウント。`api/seeds` が投入する E001（admin）と同じ値で、
 * 本番の資格情報ではない。`next dev` のときだけログインフォームの初期値に使う。
 */
const LOCAL_SEED_LOGIN: LoginDefaults = {
  email: "you+e001@example.com",
  password: "password",
}

/**
 * ログインフォームの初期入力値を解決する。`next dev`（NODE_ENV=development）のときだけ
 * ローカル seed の資格情報を返し、`next build` 以降は常に null を返して何も入力しない。
 */
export function resolveLoginDefaults(nodeEnv: string | undefined): LoginDefaults | null {
  if (nodeEnv !== "development") return null

  return LOCAL_SEED_LOGIN
}
