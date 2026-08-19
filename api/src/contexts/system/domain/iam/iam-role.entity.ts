import { InvalidIamRoleError } from "@system/domain/iam/invalid-iam-role.error"
import { permissionKeySchema } from "@system/domain/iam/permission.value"
import { z } from "zod"

export const iamRoleIdSchema = z.string().min(1).max(255).brand<"IamRoleId">()

export type IamRoleId = z.infer<typeof iamRoleIdSchema>

export const iamRoleKeySchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$/)

const propsSchema = z
  .object({
    id: iamRoleIdSchema,
    key: iamRoleKeySchema,
    kind: z.enum(["managed", "custom"]),
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(1000).nullable().default(null),
    permissionKeys: z.array(permissionKeySchema).max(500),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

type Revision = Readonly<{
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
  at: Date
}>

/** 業務contextの語彙をnamespaced permissionとして束ねるSystem IAM Role。 */
export class IamRole {
  readonly id: IamRoleId
  readonly key: string
  readonly kind: "managed" | "custom"
  readonly name: string
  readonly description: string | null
  readonly permissionKeys: ReadonlyArray<string>
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.key = props.key
    this.kind = props.kind
    this.name = props.name
    this.description = props.description
    this.permissionKeys = Object.freeze([...props.permissionKeys])
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): IamRole | InvalidIamRoleError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidIamRoleError("invalid_shape", parsed.error)
    if (parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()) {
      return new InvalidIamRoleError("update_before_creation")
    }
    if (new Set(parsed.data.permissionKeys).size !== parsed.data.permissionKeys.length) {
      return new InvalidIamRoleError("duplicate_permissions")
    }
    if (!IamRole.arePermissionsSorted(parsed.data.permissionKeys)) {
      return new InvalidIamRoleError("permissions_not_sorted")
    }

    return new IamRole(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  hasPermission(permissionKey: string): boolean {
    return this.permissionKeys.includes(permissionKey)
  }

  replacePermissions(
    permissionKeys: ReadonlyArray<string>,
    at: Date,
  ): IamRole | InvalidIamRoleError {
    return this.revise({
      name: this.name,
      description: this.description,
      permissionKeys,
      at,
    })
  }

  revise(revision: Revision): IamRole | InvalidIamRoleError {
    if (this.kind === "managed") return new InvalidIamRoleError("managed_role_mutation")
    if (!Number.isFinite(revision.at.getTime())) return new InvalidIamRoleError("invalid_shape")
    if (revision.at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidIamRoleError("update_before_last_update")
    }
    if (
      revision.name === this.name &&
      revision.description === this.description &&
      this.hasSamePermissions(revision.permissionKeys)
    ) {
      return this
    }

    return IamRole.create({
      ...this.toProps(),
      name: revision.name,
      description: revision.description,
      permissionKeys: [...revision.permissionKeys],
      updatedAt: revision.at,
    })
  }

  private static arePermissionsSorted(permissionKeys: ReadonlyArray<string>): boolean {
    return permissionKeys.every(
      (permissionKey, index) => index === 0 || permissionKeys[index - 1]! < permissionKey,
    )
  }

  private hasSamePermissions(permissionKeys: ReadonlyArray<string>): boolean {
    return (
      permissionKeys.length === this.permissionKeys.length &&
      permissionKeys.every((permissionKey, index) => this.permissionKeys[index] === permissionKey)
    )
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      key: this.key,
      kind: this.kind,
      name: this.name,
      description: this.description,
      permissionKeys: [...this.permissionKeys],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
