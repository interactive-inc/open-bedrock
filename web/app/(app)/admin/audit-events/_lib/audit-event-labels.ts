const actionLabels: Readonly<Record<string, string>> = {
  "auth.session.login_succeeded": "ログイン成功",
  "auth.session.login_denied": "ログイン拒否",
  "auth.session.refreshed": "セッション更新",
  "auth.session.reuse_detected": "更新トークン再利用検知",
  "iam.role.created": "ロール作成",
  "iam.role.updated": "ロール更新",
  "iam.role.deleted": "ロール削除",
  "iam.account.role_granted": "アカウントへのロール付与",
  "iam.account.role_revoked": "アカウントのロール解除",
  "iam.account.status_changed": "アカウント状態変更",
  "iam.account.password_reset": "パスワード再設定",
  "employee.account.registered": "従業員登録",
  "employee.account.retired": "従業員の退職",
  "employee.account.deleted": "従業員の削除",
  "application.workflow.updated": "承認フロー更新",
  "application.workflow.repaired": "承認フロー修復",
  "application.delegation.created": "承認委任作成",
  "application.delegation.cancelled": "承認委任取消",
  "application.decision.approved": "申請承認",
  "application.decision.rejected": "申請却下",
  "audit.event.searched": "監査ログ検索",
  "audit.event.read": "監査イベント閲覧",
  "audit.event.exported": "監査ログのCSV出力",
}

const targetTypeLabels: Readonly<Record<string, string>> = {
  session: "セッション",
  role: "ロール",
  account: "アカウント",
  employee: "従業員",
  application_workflow: "承認フロー",
  application: "申請",
  approval_delegation: "承認委任",
  audit_event: "監査イベント",
  audit_export: "監査出力",
}

const outcomeLabels: Readonly<Record<string, string>> = {
  succeeded: "成功",
  denied: "拒否",
  failed: "失敗",
}

const clientLabels: Readonly<Record<string, string>> = {
  web: "Web",
  cli: "CLI",
  api: "API",
  system: "システム",
}

const reasonLabels: Readonly<Record<string, string>> = {
  permission_denied: "権限不足",
  invalid_credentials: "認証情報が無効",
  invalid_token: "トークンが無効",
  refresh_token_reuse: "更新トークンの再利用",
  audit_export_too_large: "出力サイズ超過",
}

function labelOf(labels: Readonly<Record<string, string>>, value: string | null): string {
  if (value === null) return "—"
  return labels[value] ?? value
}

export function auditActionLabel(value: string): string {
  return labelOf(actionLabels, value)
}

export function auditTargetTypeLabel(value: string | null): string {
  return labelOf(targetTypeLabels, value)
}

export function auditOutcomeLabel(value: string): string {
  return labelOf(outcomeLabels, value)
}

export function auditClientLabel(value: string): string {
  return labelOf(clientLabels, value)
}

export function auditReasonLabel(value: string | null): string {
  return labelOf(reasonLabels, value)
}
