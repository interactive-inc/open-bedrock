import type { TrainingPermissionKey } from "@/contexts/training/domain/catalogs/iam/training-permission-key.catalog"

type PermissionEntry = {
  key: TrainingPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Training が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const TRAINING_PERMISSION_ENTRIES = [
  {
    key: "training:manage",
    category: "training",
    featureKey: "training",
    description: "研修コースを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
