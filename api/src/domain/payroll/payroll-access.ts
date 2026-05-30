export type Forbidden = { reason: "forbidden" }

const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

// 給与の発行・改定・横断閲覧を行える特権ロールか判定する。
export function canManagePayroll(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
