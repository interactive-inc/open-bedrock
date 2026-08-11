import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { iamRoleIdSchema, type IamRoleId } from "@system/domain/iam/iam-role.entity"
import { InvalidRoleBindingError } from "@system/domain/iam/invalid-role-binding.error"
import { permissionKeySchema } from "@system/domain/iam/permission.value"
import { z } from "zod"

export const roleBindingIdSchema = z.string().min(1).max(255).brand<"RoleBindingId">()

export type RoleBindingId = z.infer<typeof roleBindingIdSchema>

export const roleBindingResourceSchema = z
  .object({
    type: permissionKeySchema,
    id: z.string().min(1).max(255),
  })
  .strict()

export type RoleBindingResource = Readonly<z.output<typeof roleBindingResourceSchema>>

const propsSchema = z
  .object({
    id: roleBindingIdSchema,
    accountId: zAccountId,
    roleId: iamRoleIdSchema,
    resource: roleBindingResourceSchema.nullable(),
    createdAt: z.date(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** AccountへRoleをglobalまたはopaque resource単位で関連付けるSystem binding。 */
export class RoleBinding {
  readonly id: RoleBindingId
  readonly accountId: AccountId
  readonly roleId: IamRoleId
  readonly resource: RoleBindingResource | null
  readonly #createdAtEpochMilliseconds: number
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.accountId = props.accountId
    this.roleId = props.roleId
    this.resource =
      props.resource === null
        ? null
        : Object.freeze({ type: props.resource.type, id: props.resource.id })
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): RoleBinding | InvalidRoleBindingError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidRoleBindingError("invalid_shape", parsed.error)
    if (
      parsed.data.revokedAt !== null &&
      parsed.data.revokedAt.getTime() < parsed.data.createdAt.getTime()
    ) {
      return new InvalidRoleBindingError("revocation_before_creation")
    }

    return new RoleBinding(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return this.#revokedAtEpochMilliseconds === null
      ? null
      : new Date(this.#revokedAtEpochMilliseconds)
  }

  isActiveAt(at: Date): boolean {
    const atEpochMilliseconds = at.getTime()

    return (
      Number.isFinite(atEpochMilliseconds) &&
      atEpochMilliseconds >= this.#createdAtEpochMilliseconds &&
      (this.#revokedAtEpochMilliseconds === null ||
        atEpochMilliseconds < this.#revokedAtEpochMilliseconds)
    )
  }

  appliesTo(resource: RoleBindingResource | null): boolean {
    if (this.resource === null) return true
    if (resource === null) return false

    return this.resource.type === resource.type && this.resource.id === resource.id
  }

  revoke(at: Date): RoleBinding | InvalidRoleBindingError {
    if (this.#revokedAtEpochMilliseconds !== null) {
      if (!Number.isFinite(at.getTime())) return new InvalidRoleBindingError("invalid_shape")
      if (at.getTime() < this.#revokedAtEpochMilliseconds) {
        return new InvalidRoleBindingError("transition_before_last_update")
      }

      return this
    }

    return RoleBinding.create({ ...this.toProps(), revokedAt: at })
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      accountId: this.accountId,
      roleId: this.roleId,
      resource: this.resource === null ? null : { ...this.resource },
      createdAt: this.createdAt,
      revokedAt: this.revokedAt,
    }
  }
}
