const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** アンケートの作成・変更・削除を行える権限を持つか。 */
export function canManageSurveys(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
