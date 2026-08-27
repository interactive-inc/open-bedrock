import { z } from "zod"

const gradePropsSchema = z.object({
  id: z.number().int().positive().nullable(),
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  rank: z.number().int(),
  description: z.string().trim().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime(),
})

export type GradeProps = z.infer<typeof gradePropsSchema>

/** Company内で利用する等級定義。 */
export class GradeEntity {
  private constructor(private readonly props: GradeProps) {
    Object.freeze(this)
  }

  static create(props: Omit<GradeProps, "id">): GradeEntity {
    return new GradeEntity(gradePropsSchema.parse({ ...props, id: null }))
  }

  static restore(props: GradeProps): GradeEntity {
    return new GradeEntity(gradePropsSchema.parse(props))
  }

  withDetails(props: Pick<GradeProps, "code" | "name" | "rank" | "description">): GradeEntity {
    return new GradeEntity(gradePropsSchema.parse({ ...this.props, ...props }))
  }

  toProps(): GradeProps {
    return this.props
  }
}
