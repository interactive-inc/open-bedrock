import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { CareerPostingRow } from "@/contexts/career/infrastructure/schema/career"
import { z } from "zod"

const zProps = z.object({
  id: z.string().nullable(),
  title: z.string(),
  organizationUnitId: zOrganizationUnitId.nullable(),
  legacyDeptName: z.string().nullable(),
  requiredSkills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

type Props = z.infer<typeof zProps>

/**
 * 社内公募（募集部署・必要スキル・公開状態）。集約ルート。
 * 募集部署は Company の組織単位を参照する。legacyDeptName は組織単位を参照できなかった頃に
 * 手入力された部署名で、表示の補助として読み出すだけで新たに書き込まない。
 */
export class CareerPosting implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly organizationUnitId!: Props["organizationUnitId"]

  readonly legacyDeptName!: Props["legacyDeptName"]

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
    organizationUnitId: OrganizationUnitId | null
    requiredSkills: string | null
    status: "open" | "closed"
  }): CareerPosting {
    return new CareerPosting({
      id: null,
      title: props.title,
      organizationUnitId: props.organizationUnitId,
      legacyDeptName: null,
      requiredSkills: props.requiredSkills,
      status: props.status,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: CareerPostingRow): CareerPosting {
    return new CareerPosting({
      id: row.id,
      title: row.title,
      organizationUnitId: row.organizationUnitId,
      legacyDeptName: row.deptName,
      requiredSkills: row.requiredSkills,
      status: toPostingStatus(row.status),
    })
  }

  /** 内容（タイトル・募集部署・必要スキル・状態）を変更した新しい公募を返す。id と旧部署名は保つ。 */
  withDetails(props: {
    title: string
    organizationUnitId: OrganizationUnitId | null
    requiredSkills: string | null
    status: "open" | "closed"
  }): CareerPosting {
    return new CareerPosting({
      ...this.props,
      title: props.title,
      organizationUnitId: props.organizationUnitId,
      requiredSkills: props.requiredSkills,
      status: props.status,
    })
  }
}

function toPostingStatus(status: string): CareerPosting["status"] {
  return status === "closed" ? "closed" : "open"
}
