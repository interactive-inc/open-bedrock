import type { CareerPostingRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  title: z.string(),
  deptId: z.number().nullable(),
  deptName: z.string().nullable(),
  requiredSkills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

type Props = z.infer<typeof zProps>

// 社内公募（部署・必要スキル・公開状態）。集約ルート。
export class CareerPosting implements Props {
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

  // 永続化された行から復元する。
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
}

function toPostingStatus(status: string): CareerPosting["status"] {
  return status === "closed" ? "closed" : "open"
}
