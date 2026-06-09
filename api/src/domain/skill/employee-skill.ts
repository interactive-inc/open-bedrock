import type { EmployeeSkillRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  employeeId: z.number(),
  skillCode: z.string(),
  level: z.number().int().min(1).max(10),
  years: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

// 従業員ごとの登録スキル（レベル・経験年数・補足）。集約ルート。
// 主キーは employeeId×skillCode の業務キー。
export class EmployeeSkill implements Props {
  readonly employeeId!: Props["employeeId"]

  readonly skillCode!: Props["skillCode"]

  readonly level!: Props["level"]

  readonly years!: Props["years"]

  readonly note!: Props["note"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 登録・更新するスキルを組み立てる。業務キーを含む全フィールドを受け取る。
  static create(props: {
    employeeId: number
    skillCode: string
    level: number
    years: number | null
    note: string | null
  }): EmployeeSkill {
    return new EmployeeSkill({
      employeeId: props.employeeId,
      skillCode: props.skillCode,
      level: props.level,
      years: props.years,
      note: props.note,
    })
  }

  // 永続化された行から復元する。
  static fromRow(row: EmployeeSkillRow): EmployeeSkill {
    return new EmployeeSkill({
      employeeId: row.employeeId,
      skillCode: row.skillCode,
      level: row.level,
      years: row.years,
      note: row.note,
    })
  }
}
