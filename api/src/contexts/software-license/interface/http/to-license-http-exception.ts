import { LicenseError } from "@/contexts/software-license/domain/errors"
import { SoftwareLicenseOperationError } from "@/contexts/software-license/interface/errors"

/** 台帳が拒否した理由をHTTPへ変換する。 */
export function toLicenseHttpException(error: LicenseError): SoftwareLicenseOperationError {
  return new SoftwareLicenseOperationError(error)
}
