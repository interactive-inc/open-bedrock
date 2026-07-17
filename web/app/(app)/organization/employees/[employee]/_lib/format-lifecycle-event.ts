const kindLabels: Readonly<Record<string, string>> = {
  hire: "入社",
  rehire: "再入社",
  primary_assignment_started: "配属",
  transferred: "異動",
  concurrent_assignment_started: "兼務開始",
  assignment_ended: "所属終了",
  position_changed: "役職変更",
  manager_changed: "上司変更",
  department_responsibility_started: "部署責任者就任",
  department_responsibility_ended: "部署責任者退任",
  leave_started: "休職",
  returned: "復職",
  retired: "退職",
  corrected: "訂正",
  legacy_baseline: "移行時点",
}

const statusLabels: Readonly<Record<string, string>> = {
  confirmed: "確定",
  scheduled: "予定",
  corrected: "訂正済み",
  correction: "訂正",
  migration: "移行時点",
}

const lifecycleDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "long",
  timeZone: "UTC",
})

export function formatLifecycleKind(kind: string): string {
  return kindLabels[kind] ?? kind
}

export function formatLifecycleDisplayStatus(status: string): string {
  return statusLabels[status] ?? status
}

export function formatLifecycleDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (!match) return value
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return value
  }
  return lifecycleDateFormatter.format(date)
}

function stringOrNone(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "なし"
}

export function summarizeLifecycleEvent(summary: unknown): ReadonlyArray<string> {
  if (summary === null || typeof summary !== "object" || Array.isArray(summary)) return []
  const value = summary as Record<string, unknown>
  const department = value.department
  const parts: string[] = []
  if (department !== null && typeof department === "object" && !Array.isArray(department)) {
    const data = department as Record<string, unknown>
    if (typeof data.name === "string") parts.push(`部署: ${data.name}`)
  }
  if (typeof value.previousPositionTitle === "string") {
    parts.push(`役職: ${value.previousPositionTitle} → ${stringOrNone(value.positionTitle)}`)
  } else if (typeof value.positionTitle === "string") {
    parts.push(`役職: ${value.positionTitle}`)
  }
  if ("previousManagerEmployeeCode" in value) {
    parts.push(
      `上司: ${stringOrNone(value.previousManagerEmployeeCode)} → ${stringOrNone(value.managerEmployeeCode)}`,
    )
  } else if (typeof value.managerEmployeeCode === "string") {
    parts.push(`上司: ${value.managerEmployeeCode}`)
  }
  if (typeof value.status === "string") parts.push(`状態: ${value.status}`)
  return parts
}
