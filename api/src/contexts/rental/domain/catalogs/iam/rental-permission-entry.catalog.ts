import type { RentalPermissionKey } from "@/contexts/rental/domain/catalogs/iam/rental-permission-key.catalog"

type PermissionEntry = {
  key: RentalPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Rental が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const RENTAL_PERMISSION_ENTRIES = [
  {
    key: "rental:manage",
    category: "rental",
    featureKey: "rentals",
    description: "貸与品予約の状態を代理で進める",
  },
  {
    key: "rental:read:all",
    category: "rental",
    featureKey: "rentals",
    description: "全社の貸与品予約を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
