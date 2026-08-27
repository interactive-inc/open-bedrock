import { z } from "zod"

const positionPropsSchema = z.object({
  id: z.number().int().positive().nullable(),
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  rank: z.number().int(),
  description: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
})

export type PositionProps = z.infer<typeof positionPropsSchema>

/** Company内で利用する役職定義。 */
export class PositionEntity {
  private constructor(private readonly props: PositionProps) {
    Object.freeze(this)
  }

  static create(props: Omit<PositionProps, "id">): PositionEntity {
    return new PositionEntity(positionPropsSchema.parse({ ...props, id: null }))
  }

  static restore(props: PositionProps): PositionEntity {
    return new PositionEntity(positionPropsSchema.parse(props))
  }

  withDetails(
    props: Pick<PositionProps, "code" | "name" | "rank" | "description">,
  ): PositionEntity {
    return new PositionEntity(positionPropsSchema.parse({ ...this.props, ...props }))
  }

  toProps(): PositionProps {
    return this.props
  }
}
