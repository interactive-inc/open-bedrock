import type { DocumentPermissionKey } from "@/contexts/document/domain/catalogs/iam/document-permission-key.catalog"

type PermissionEntry = {
  key: DocumentPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Document が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const DOCUMENT_PERMISSION_ENTRIES = [
  {
    key: "document:manage",
    category: "document",
    featureKey: null,
    description: "文書台帳を管理する",
  },
  {
    key: "document:read:all",
    category: "document",
    featureKey: null,
    description: "文書台帳を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
