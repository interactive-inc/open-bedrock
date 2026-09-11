import { SoftwareLicenseInputError } from "@/contexts/software-license/interface/errors"

/** 契約登録の再送キーを検査する。 */
export function parseLicenseCommandId(value: string | undefined): string {
  if (value === undefined)
    throw new SoftwareLicenseInputError({ message: "required Idempotency-Key" })
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/.test(value))
    throw new SoftwareLicenseInputError({ message: "invalid Idempotency-Key" })
  return value
}
