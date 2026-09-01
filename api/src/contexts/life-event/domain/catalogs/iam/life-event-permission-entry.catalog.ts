import type { LifeEventPermissionKey } from "@/contexts/life-event/domain/catalogs/iam/life-event-permission-key.catalog"

type PermissionEntry = {
  key: LifeEventPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * LifeEvent が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const LIFE_EVENT_PERMISSION_ENTRIES = [
  {
    key: "life_event:manage",
    category: "life-event",
    featureKey: "life-events",
    description: "ライフイベント届の状態を代理で進める",
  },
  {
    key: "life_event:read:all",
    category: "life-event",
    featureKey: "life-events",
    description: "全社のライフイベント届を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
