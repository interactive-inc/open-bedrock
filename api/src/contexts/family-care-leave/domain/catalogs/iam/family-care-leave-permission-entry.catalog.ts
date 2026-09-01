import type { FamilyCareLeavePermissionKey } from "@/contexts/family-care-leave/domain/catalogs/iam/family-care-leave-permission-key.catalog"

type PermissionEntry = {
  key: FamilyCareLeavePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * FamilyCareLeave が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const FAMILY_CARE_LEAVE_PERMISSION_ENTRIES = [
  {
    key: "family_care_leave:manage",
    category: "family-care-leave",
    featureKey: "family-care-leave",
    description: "産休・育休・介護休業の申出の状態を代理で進める",
  },
  {
    key: "family_care_leave:read:all",
    category: "family-care-leave",
    featureKey: "family-care-leave",
    description: "全社の産休・育休・介護休業の申出を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
