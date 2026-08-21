import { z } from "zod"

export class OrganizationProfileValue {
  readonly name: string
  readonly representativeName: string

  private constructor(value: Readonly<{ name: string; representativeName: string }>) {
    this.name = value.name
    this.representativeName = value.representativeName
    Object.freeze(this)
  }

  static create(value: unknown): OrganizationProfileValue | Error {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(200),
        representativeName: z.string().trim().min(1).max(200),
      })
      .safeParse(value)
    return parsed.success ? new OrganizationProfileValue(parsed.data) : parsed.error
  }
}
