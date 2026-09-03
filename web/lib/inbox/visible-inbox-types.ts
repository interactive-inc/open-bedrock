import type { InboxCounts } from "@/lib/api/types/inbox-types"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * 受信箱の種類定義。inbox layout のタブとサイドバーの inbox children が同じ集合になるよう
 * ここを唯一の情報源にする。requiredPermission が未指定の種類は全員に表示する。
 * countKey を持つ種類だけ InboxCounts からバッジ件数を引ける（api の /inbox/counts が返す 5 種）。
 */
export type InboxType = {
  key: string
  label: string
  href: string
  requiredPermission?: PermissionKey
  countKey?: keyof InboxCounts
}

export const inboxTypes: ReadonlyArray<InboxType> = [
  {
    key: "applications",
    label: "申請",
    href: "/inbox/applications",
    countKey: "applications",
  },
  {
    key: "expenses",
    label: "経費",
    href: "/inbox/expenses",
    requiredPermission: "expense:approve",
    countKey: "expenses",
  },
  {
    key: "leaves",
    label: "休暇",
    href: "/inbox/leaves",
    requiredPermission: "leave:approve",
    countKey: "leaves",
  },
  {
    key: "shift-swaps",
    label: "シフト交代",
    href: "/inbox/shift-swaps",
    requiredPermission: "shift_swap:approve",
    countKey: "shifts",
  },
  {
    key: "thanks-redemptions",
    label: "サンクス交換",
    href: "/inbox/thanks-redemptions",
    requiredPermission: "thanks_redemption:approve",
    countKey: "thanks",
  },
  {
    key: "ringis",
    label: "稟議",
    href: "/inbox/ringis",
  },
  {
    key: "antisocial-checks",
    label: "反社チェック判定",
    href: "/inbox/antisocial-checks",
    requiredPermission: "antisocial_check:manage",
  },
]

/** 本人の permission で表示可能な受信箱の種類だけに絞り込む。 */
export function visibleInboxTypes(permissions: ReadonlyArray<string>): ReadonlyArray<InboxType> {
  const permissionSet = new Set(permissions)

  return inboxTypes.filter(
    (inboxType) =>
      inboxType.requiredPermission === undefined || permissionSet.has(inboxType.requiredPermission),
  )
}
