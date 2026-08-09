import type { Session } from "@/domain/company/iam/session"
import type { AssetRow } from "@/schema"

type AssetResponse = {
  code: string
  name: string
  kind: string
  serial: string | null
  purchased_on: string | null
  status: string
  holder_employee_id: number | null
}

/**
 * 資産カタログの共通レスポンスを組み立てる。
 * 管理権限者または現在の保有者以外には、台帳上の機微項目を返さない。
 */
export function toAssetResponse(row: AssetRow, session: Session): AssetResponse {
  const canViewSensitiveFields =
    session.hasPermission("asset:manage") || row.holderEmployeeId === session.employeeId

  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    serial: canViewSensitiveFields ? row.serial : null,
    purchased_on: canViewSensitiveFields ? row.purchasedOn : null,
    status: row.status,
    holder_employee_id: canViewSensitiveFields ? row.holderEmployeeId : null,
  }
}
