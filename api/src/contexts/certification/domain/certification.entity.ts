import type { CertificationRow } from "@/contexts/certification/infrastructure/schema/certification"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 資格・免許マスタ。会社で管理対象とする資格の台帳（発行判定や計算は持たない）。
 */
export class Certification implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly issuer!: Props["issuer"]

  readonly description!: Props["description"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: CertificationRow): Certification {
    return new Certification({
      id: row.id,
      code: row.code,
      name: row.name,
      issuer: row.issuer,
      description: row.description,
      createdAt: row.createdAt,
    })
  }

  /** 名称・発行元・説明を更新した新しいマスタを返す。 */
  withDetails(props: {
    name: string
    issuer: string | null
    description: string | null
  }): Certification {
    return new Certification({
      ...this.props,
      name: props.name,
      issuer: props.issuer,
      description: props.description,
    })
  }
}
