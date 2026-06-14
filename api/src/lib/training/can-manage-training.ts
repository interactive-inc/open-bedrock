const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 研修コースの作成や他者への割り当てを行える権限を持つか。 */
export function canManageTraining(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
