import type { ShiftPermissionKey } from "@/contexts/shift/domain/catalogs/iam/shift-permission-key.catalog"

type PermissionEntry = {
  key: ShiftPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Shift が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const SHIFT_PERMISSION_ENTRIES = [
  {
    key: "shift_swap:approve",
    category: "shift",
    featureKey: "shifts",
    description: "シフト交代を承認する",
  },
  {
    key: "shift_swap:read:all",
    category: "shift",
    featureKey: "shifts",
    description: "全社のシフト交代申請を横断で閲覧する",
  },
  {
    key: "shift:manage",
    category: "shift",
    featureKey: "shifts",
    description: "シフトを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
