import type { CareerPostingRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  deptId: z.number().nullable(),
  deptName: z.string().nullable(),
  requiredSkills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

type Props = z.infer<typeof zProps>

/** 社内公募（部署・必要スキル・公開状態）。集約ルート。 */
export class CareerPosting implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly deptId!: Props["deptId"]

  readonly deptName!: Props["deptName"]

  readonly requiredSkills!: Props["requiredSkills"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する社内公募を組み立てる。id は未採番、status は引数で受ける。 */
  static create(props: {
    title: string
    deptId: number | null
    deptName: string | null
    requiredSkills: string | null
    status: "open" | "closed"
  }): CareerPosting {
    return new CareerPosting({
      id: null,
      title: props.title,
      deptId: props.deptId,
      deptName: props.deptName,
      requiredSkills: props.requiredSkills,
      status: props.status,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: CareerPostingRow): CareerPosting {
    return new CareerPosting({
      id: row.id,
      title: row.title,
      deptId: row.deptId,
      deptName: row.deptName,
      requiredSkills: row.requiredSkills,
      status: toPostingStatus(row.status),
    })
  }

  /** 内容（タイトル・部署・必要スキル・状態）を変更した新しい公募を返す。id は保つ。 */
  withDetails(props: {
    title: string
    deptId: number | null
    deptName: string | null
    requiredSkills: string | null
    status: "open" | "closed"
  }): CareerPosting {
    return new CareerPosting({
      ...this.props,
      title: props.title,
      deptId: props.deptId,
      deptName: props.deptName,
      requiredSkills: props.requiredSkills,
      status: props.status,
    })
  }
}

function toPostingStatus(status: string): CareerPosting["status"] {
  return status === "closed" ? "closed" : "open"
}
