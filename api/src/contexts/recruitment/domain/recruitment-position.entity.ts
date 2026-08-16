import type { RecruitmentPositionRow } from "@/contexts/recruitment/infrastructure/schema/recruitment"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  departmentCode: z.string().nullable(),
  status: z.enum(["open", "closed"]),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 採用の募集ポジション。id は新規作成時 null、DB 採番後に確定する。 */
export class RecruitmentPosition implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly departmentCode!: Props["departmentCode"]

  readonly status!: Props["status"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規登録する募集を組み立てる。id は未採番、初期状態は open。 */
  static create(props: {
    title: string
    departmentCode: string | null
    status: Props["status"]
    note: string | null
    createdAt: string
  }): RecruitmentPosition {
    return new RecruitmentPosition({
      id: null,
      title: props.title,
      departmentCode: props.departmentCode,
      status: props.status,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RecruitmentPositionRow): RecruitmentPosition {
    return new RecruitmentPosition({
      id: row.id,
      title: row.title,
      departmentCode: row.departmentCode,
      status: zProps.shape.status.parse(row.status),
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** タイトル・部署・状態・備考を差し替える。 */
  withDetails(details: {
    title: Props["title"]
    departmentCode: Props["departmentCode"]
    status: Props["status"]
    note: Props["note"]
  }): RecruitmentPosition {
    return new RecruitmentPosition({
      ...this.props,
      title: details.title,
      departmentCode: details.departmentCode,
      status: details.status,
      note: details.note,
    })
  }
}
