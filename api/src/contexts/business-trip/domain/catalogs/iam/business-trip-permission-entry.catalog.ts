import type { BusinessTripPermissionKey } from "@/contexts/business-trip/domain/catalogs/iam/business-trip-permission-key.catalog"

type PermissionEntry = {
  key: BusinessTripPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * BusinessTrip が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const BUSINESS_TRIP_PERMISSION_ENTRIES = [
  {
    key: "business_trip:manage",
    category: "business-trip",
    featureKey: "business-trips",
    description: "出張申請の状態を代理で進める",
  },
  {
    key: "business_trip:read:all",
    category: "business-trip",
    featureKey: "business-trips",
    description: "全社の出張申請を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
