import { ValidationError } from "@/lib/errors"

/**
 * パスワードの複雑性ポリシー。
 * 8文字以上200文字以下で、大文字・小文字・数字をそれぞれ1つ以上含む。
 */
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,200}$/

export const PASSWORD_POLICY_MESSAGE =
  "パスワードは8文字以上で、大文字・小文字・数字をそれぞれ1つ以上含めてください"

/** パスワードがポリシーを満たさない場合は ValidationError を返す。 */
export function validatePasswordComplexity(password: string): ValidationError | null {
  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    return new ValidationError(PASSWORD_POLICY_MESSAGE, "weak_password")
  }

  return null
}
