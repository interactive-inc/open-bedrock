import type { Session } from "@/contexts/company/domain/iam/session"

export type Props = {
  session: Session
  /** 対象部門コード。 */
  departmentCode: string
  /** viewer が基準日時点で所属するcanonical組織単位コード。無所属ならnull。 */
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
