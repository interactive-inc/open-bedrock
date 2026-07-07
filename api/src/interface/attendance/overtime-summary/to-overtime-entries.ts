export type WorkMinutesRow = {
  employeeId: number
  workMinutes: number | null
}

export type OvertimeEntry = {
  employeeId: number
  workDays: number
  totalWorkMinutes: number
  overtimeMinutes: number
}

// 勤怠行を従業員ごとにまとめ、1 日 8 時間×営業日を超えた分を時間外の参考値として算出する純関数。
// 法定判定ではない。work_minutes が null の行(打刻途中)は労働時間 0・営業日カウント外として扱う。
export function toOvertimeEntries(props: {
  rows: ReadonlyArray<WorkMinutesRow>
  businessDays: number
  dailyRegularMinutes: number
}): ReadonlyArray<OvertimeEntry> {
  const totalsByEmployee = new Map<number, { workDays: number; totalWorkMinutes: number }>()

  for (const row of props.rows) {
    const current = totalsByEmployee.get(row.employeeId) ?? { workDays: 0, totalWorkMinutes: 0 }

    if (row.workMinutes === null) {
      totalsByEmployee.set(row.employeeId, current)

      continue
    }

    totalsByEmployee.set(row.employeeId, {
      workDays: current.workDays + 1,
      totalWorkMinutes: current.totalWorkMinutes + row.workMinutes,
    })
  }

  const regularCapMinutes = props.businessDays * props.dailyRegularMinutes

  const entries: Array<OvertimeEntry> = []

  for (const [employeeId, totals] of totalsByEmployee) {
    const overtimeMinutes = Math.max(0, totals.totalWorkMinutes - regularCapMinutes)

    entries.push({
      employeeId,
      workDays: totals.workDays,
      totalWorkMinutes: totals.totalWorkMinutes,
      overtimeMinutes,
    })
  }

  entries.sort((a, b) => a.employeeId - b.employeeId)

  return entries
}
