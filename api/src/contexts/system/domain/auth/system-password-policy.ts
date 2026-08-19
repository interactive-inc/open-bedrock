export type SystemPasswordPolicyViolation = "password_too_long" | "password_too_short"

/**
 * パスフレーズを許容し、compositionごとの複雑性規則をSystem credentialへ持ち込まない。
 * 上限はhash処理による資源枯渇を防ぎ、下限はbootstrap時の弱い初期credentialを拒否する。
 */
export function validateSystemPassword(password: string): SystemPasswordPolicyViolation | null {
  if (password.length < 12) return "password_too_short"
  if (password.length > 200) return "password_too_long"

  return null
}
