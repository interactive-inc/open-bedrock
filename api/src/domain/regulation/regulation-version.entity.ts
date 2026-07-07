import type { RegulationVersionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  regulationId: z.number(),
  version: z.number().int(),
  bodyMd: z.string(),
  effectiveOn: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 規程の改定版1件。version は同一規程内の連番。 */
export class RegulationVersion implements Props {
  readonly id!: Props["id"]

  readonly regulationId!: Props["regulationId"]

  readonly version!: Props["version"]

  readonly bodyMd!: Props["bodyMd"]

  readonly effectiveOn!: Props["effectiveOn"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新しい改定版を組み立てる。id は未採番。 */
  static create(props: {
    regulationId: number
    version: number
    bodyMd: string
    effectiveOn: string
    note: string | null
    createdAt: string
  }): RegulationVersion {
    return new RegulationVersion({
      id: null,
      regulationId: props.regulationId,
      version: props.version,
      bodyMd: props.bodyMd,
      effectiveOn: props.effectiveOn,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RegulationVersionRow): RegulationVersion {
    return new RegulationVersion({
      id: row.id,
      regulationId: row.regulationId,
      version: row.version,
      bodyMd: row.bodyMd,
      effectiveOn: row.effectiveOn,
      note: row.note,
      createdAt: row.createdAt,
    })
  }
}
