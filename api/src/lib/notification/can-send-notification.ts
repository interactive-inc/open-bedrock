const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

/** 通知を送信できる権限を持つ役割かどうかを判定する純粋関数。 */
export function canSendNotification(viewerRole: string): boolean {
  return privilegedRoles.includes(viewerRole)
}
