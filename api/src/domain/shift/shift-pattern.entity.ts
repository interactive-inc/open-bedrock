import type { ShiftPatternRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number().int().nonnegative(),
})

type Props = z.infer<typeof zProps>

// シフトパターン（勤務時間帯と休憩の雛形）。集約ルート。
export class ShiftPattern implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly startTime!: Props["startTime"]

  readonly endTime!: Props["endTime"]

  readonly breakMinutes!: Props["breakMinutes"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成するシフトパターンを組み立てる。id は未採番。
  static create(props: {
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
  }): ShiftPattern {
    return new ShiftPattern({
      id: null,
      code: props.code,
      name: props.name,
      startTime: props.startTime,
      endTime: props.endTime,
      breakMinutes: props.breakMinutes,
    })
  }

  static fromRow(row: ShiftPatternRow): ShiftPattern {
    return new ShiftPattern({
      id: row.id,
      code: row.code,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
      breakMinutes: row.breakMinutes,
    })
  }

  // コード・名前・勤務時間・休憩を変更した新しいパターンを返す。
  withDetails(props: {
    code: string
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
  }): ShiftPattern {
    return new ShiftPattern({
      ...this.props,
      code: props.code,
      name: props.name,
      startTime: props.startTime,
      endTime: props.endTime,
      breakMinutes: props.breakMinutes,
    })
  }
}
