import type { InboxCounts } from "@/lib/api/types/inbox-types"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * 受信箱の種類定義。inbox layout のタブとサイドバーの inbox children が同じ集合になるよう
 * ここを唯一の情報源にする。requiredPermission が未指定の種類は全員に表示する。
 * countKey を持つ種類だけ InboxCounts からバッジ件数を引ける（api の /inbox/counts が返す 5 種）。
 */
export type InboxType = {
  key: string
  featureKey: string | null
  label: string
  href: string
  requiredPermission?: PermissionKey
  countKey?: Exclude<keyof InboxCounts, "expenses_has_more">
}

export const inboxTypes: ReadonlyArray<InboxType> = [
  {
    key: "applications",
    featureKey: null,
    label: "申請",
    href: "/inbox/applications",
    countKey: "applications",
  },
  {
    key: "expenses",
    featureKey: "expenses",
    label: "経費",
    href: "/inbox/expenses",
    requiredPermission: "expense:approve",
    countKey: "expenses",
  },
  {
    key: "leaves",
    featureKey: "leave",
    label: "休暇",
    href: "/inbox/leaves",
    requiredPermission: "leave:approve",
    countKey: "leaves",
  },
  {
    key: "shift-swaps",
    featureKey: "shifts",
    label: "シフト交代",
    href: "/inbox/shift-swaps",
    requiredPermission: "shift_swap:approve",
    countKey: "shifts",
  },
  {
    key: "thanks-redemptions",
    featureKey: "thanks",
    label: "サンクス交換",
    href: "/inbox/thanks-redemptions",
    requiredPermission: "thanks_redemption:approve",
    countKey: "thanks",
  },
  {
    key: "ringis",
    featureKey: "ringi",
    label: "稟議",
    href: "/inbox/ringis",
  },
  {
    key: "antisocial-checks",
    featureKey: "antisocial-checks",
    label: "反社チェック判定",
    href: "/inbox/antisocial-checks",
    requiredPermission: "antisocial_check:manage",
  },
]

/** 本人の permission で表示可能な受信箱の種類だけに絞り込む。 */
export function visibleInboxTypes(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string>,
): ReadonlyArray<InboxType> {
  const permissionSet = new Set(permissions)
  const disabled = new Set(disabledFeatures)

  return inboxTypes.filter(
    (inboxType) =>
      (inboxType.featureKey === null || !disabled.has(inboxType.featureKey)) &&
      (inboxType.requiredPermission === undefined ||
        permissionSet.has(inboxType.requiredPermission)),
  )
}
