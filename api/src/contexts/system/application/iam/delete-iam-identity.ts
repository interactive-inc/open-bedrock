import { SystemPermission } from "@system/domain/iam/system-permission.catalog"
import {
  IamApplicationError,
  IamAssignmentForbiddenApplicationError,
  IamIdentityNotFoundApplicationError,
  InvalidIamIdentityApplicationError,
} from "@/contexts/system/application/iam/errors"
import { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import { IamIdentityRepository } from "@/contexts/system/infrastructure/iam/iam-identity.repository"
import type {
  SystemAuthorizationContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
type IamIdentityItem = Readonly<{
  id: string
  userId: string
  provider: string
  providerSubject: string
  email: string | null
  passwordHash: string | null
  canReceiveEmail: boolean
  emailVerifiedAt: Date | null
  passwordChangedAt: Date | null
  createdAt: Date
  updatedAt: Date
}>
type Props = Readonly<{
  identityId: string
  identity: IamIdentityItem | null
  targetHoldsRoot: boolean
}>

export class DeleteIamIdentity {
  static readonly featureId = "00570003"

  constructor(private readonly c: SystemDatabaseContext & SystemAuthorizationContext) {}

  static authorize(
    actorUserId: string,
    targetUserId: string,
    permissions: ReadonlySet<string>,
  ): IamAssignmentForbiddenApplicationError | null {
    return actorUserId === targetUserId ||
      permissions.has(SystemPermission.SYSTEM_ADMIN.key) ||
      permissions.has(SystemPermission.IAM_WRITE.key)
      ? null
      : new IamAssignmentForbiddenApplicationError(
          "forbidden",
          "他のアカウントのログイン方法を削除する権限がありません。",
        )
  }

  async execute(props: Props) {
    if (props.identity === null) {
      return new IamIdentityNotFoundApplicationError()
    }

    const identity = IamIdentityEntity.create(props.identity)

    if (identity instanceof Error) {
      return new IamApplicationError(identity)
    }

    const isSelf = this.c.var.userId === identity.userId
    const authorizationError = DeleteIamIdentity.authorize(
      this.c.var.userId,
      identity.userId,
      this.c.var.permissions,
    )

    if (authorizationError !== null) {
      return authorizationError
    }

    if (
      !isSelf &&
      props.targetHoldsRoot &&
      !this.c.var.permissions.has(SystemPermission.SYSTEM_ADMIN.key)
    ) {
      return new IamAssignmentForbiddenApplicationError(
        "iam.root_grant_forbidden",
        "システム管理者のログイン方法を削除できるのはシステム管理者だけです。",
      )
    }

    const repository = new IamIdentityRepository(this.c)
    const deletionEntity = WriteOperationEntity.create("delete", { entity: identity })

    const writeResult = await repository.write(deletionEntity)

    if (writeResult instanceof Error) {
      return new IamApplicationError(writeResult)
    }

    if (!writeResult) {
      return new InvalidIamIdentityApplicationError(
        "identity.last_remaining",
        "最後に残る設定済みログイン方法は削除できません。",
      )
    }

    return { ok: true as const }
  }
}
