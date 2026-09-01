import type { CompanyCalendarPermissionKey } from "@/contexts/company-calendar/domain/catalogs/iam/company-calendar-permission-key.catalog"

type PermissionEntry = {
  key: CompanyCalendarPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * CompanyCalendar が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const COMPANY_CALENDAR_PERMISSION_ENTRIES = [
  {
    key: "calendar:manage",
    category: "calendar",
    featureKey: "company-calendar",
    description: "会社カレンダーを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
