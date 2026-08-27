import type { Context } from "@/env"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"

/**
 * 初期基準日と会社タイムゾーンを検証する。問題があれば ValidationError、正常なら undefined を返す
 */
export function validateCompanyInitializationInput(
  c: Context,
  props: { baselineOn: string; timeZone: string },
): ApplicationError | undefined {
  if (!isoDate.safeParse(props.baselineOn).success) {
    return new ValidationError("初期基準日が不正です", "personnel_action_invalid_transition")
  }

  if (props.timeZone.trim().length === 0 || props.timeZone !== c.env.COMPANY_TIME_ZONE) {
    return new ValidationError("会社タイムゾーンが一致しません", "company_timezone_unavailable")
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: props.timeZone }).format(new Date(0))
  } catch (cause) {
    return new ValidationError("会社タイムゾーンが不正です", "company_timezone_unavailable", {
      cause,
    })
  }

  return undefined
}
