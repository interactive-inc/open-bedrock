import type { Session } from "@/lib/auth/session"

export type Props = {
  session: Session
  /** 対象部門コード。 */
  departmentCode: string
  /** viewer が所属する部門コード(org_memberships 由来)。無所属なら null。 */
  viewerDepartmentCode: string | null
}

/**
 * 部門目標を作成・編集できるか判定する。評価サイクルの運営者(review:administer)は全部門を、
 * レポートライン配下を評価できるマネージャー(goal:evaluate:reports)は自分の所属部門のみ扱える。
 */
export function canWriteDepartmentGoal(props: Props): boolean {
  if (props.session.hasPermission("review:administer")) {
    return true
  }

  if (props.session.hasPermission("goal:evaluate:reports") === false) {
    return false
  }

  return props.viewerDepartmentCode !== null && props.viewerDepartmentCode === props.departmentCode
}
