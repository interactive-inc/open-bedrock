export type Forbidden = { reason: "forbidden" }

const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

export function canViewOthers(role: string): boolean {
  return privilegedRoles.includes(role)
}

export function canEvaluateAsManager(role: string): boolean {
  return privilegedRoles.includes(role)
}
