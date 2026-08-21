import type { Session } from "@/contexts/company/domain/iam/session"

/**
 * 停止した workflow の修復（担当者の付け替え）を行えるかを判定する。
 * 修復候補の一覧と実行で同じ条件を使い、「一覧には出るが実行できない」を防ぐ。
 */
export function canRepairWorkflow(session: Session): boolean {
  return (
    session.hasPermission("application:read:all") &&
    session.hasPermission("application_template:manage")
  )
}
