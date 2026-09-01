import type { AnnouncementPermissionKey } from "@/contexts/announcement/domain/catalogs/iam/announcement-permission-key.catalog"

type PermissionEntry = {
  key: AnnouncementPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Announcement が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ANNOUNCEMENT_PERMISSION_ENTRIES = [
  {
    key: "announcement:manage",
    category: "announcement",
    featureKey: null,
    description: "社内アナウンスを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
