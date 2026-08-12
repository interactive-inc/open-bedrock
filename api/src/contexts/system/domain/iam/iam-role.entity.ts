import { InvalidIamRoleError } from "@system/domain/iam/invalid-iam-role.error"
import { permissionKeySchema } from "@system/domain/iam/permission.value"
import { z } from "zod"

export const iamRoleIdSchema = z.string().min(1).max(255).brand<"IamRoleId">()

export type IamRoleId = z.infer<typeof iamRoleIdSchema>

const propsSchema = z
  .object({
    id: iamRoleIdSchema,
    key: permissionKeySchema,
    kind: z.enum(["managed", "custom"]),
    name: z.string().min(1).max(100),
    permissionKeys: z.array(permissionKeySchema).max(500),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 業務contextの語彙をnamespaced permissionとして束ねるSystem IAM Role。 */
export class IamRole {
  readonly id: IamRoleId
  readonly key: string
  readonly kind: "managed" | "custom"
  readonly name: string
  readonly permissionKeys: ReadonlyArray<string>
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.key = props.key
    this.kind = props.kind
    this.name = props.name
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
    if (this.kind === "managed") return new InvalidIamRoleError("managed_role_mutation")
    if (!Number.isFinite(at.getTime())) return new InvalidIamRoleError("invalid_shape")
    if (at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidIamRoleError("update_before_last_update")
    }
    if (this.hasSamePermissions(permissionKeys)) return this

    return IamRole.create({ ...this.toProps(), permissionKeys: [...permissionKeys], updatedAt: at })
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
      permissionKeys: [...this.permissionKeys],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
