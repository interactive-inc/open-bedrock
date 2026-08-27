import type { Context } from "@/env"
import type { ApplicationError } from "@/lib/errors"
import { PositionRepository } from "@/contexts/administration/infrastructure/repositories/position/position.repository"
import { UnexpectedError, UnprocessableError } from "@/lib/errors"

/**
 * 従業員登録の役職 code をマスタ名に解決する。
 * null は役職なしとして通し、マスタに存在しない code は 422、マスタ参照の失敗は 500 を返す。
 */
export async function resolveEmployeePositionName(
  c: Context,
  code: string | null,
): Promise<string | null | ApplicationError> {
  if (code === null) {
    return null
  }

  const position = await new PositionRepository(c).findByCode(code)

  if (position instanceof Error) {
    return new UnexpectedError("failed to resolve position code", {
      cause: position,
    })
  }

  if (position === null) {
    return new UnprocessableError("position code not found", "position_code_not_found")
  }

  return position.name
}
