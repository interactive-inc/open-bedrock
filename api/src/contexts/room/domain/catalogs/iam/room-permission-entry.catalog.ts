import type { RoomPermissionKey } from "@/contexts/room/domain/catalogs/iam/room-permission-key.catalog"

type PermissionEntry = {
  key: RoomPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Room が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ROOM_PERMISSION_ENTRIES = [
  {
    key: "room:manage",
    category: "room",
    featureKey: "rooms",
    description: "会議室を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
