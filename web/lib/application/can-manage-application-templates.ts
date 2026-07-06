/** 申請テンプレートの作成・変更・削除を行える権限（application_template:manage）を持つか判定する（api の canManageApplicationTemplates と同一基準）。 */
export function canManageApplicationTemplates(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("application_template:manage")
}
