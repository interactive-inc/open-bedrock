import { SystemPermission } from "@system/domain/iam/system-permission.catalog"
import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { InitialPasswordGenerator } from "@/contexts/system/infrastructure/auth/initial-password.generator"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import {
  AuthAccountDisabledApplicationError,
  AuthAccountNotFoundApplicationError,
  PasswordIdentityMissingApplicationError,
  PepperSecretMissingApplicationError,
  RootGrantPasswordForbiddenApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { PasswordIdentityWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordIdentityRepository } from "@/contexts/system/infrastructure/auth/password-identity.repository"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemDatabaseContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
import { ApplicationForbiddenError } from "@/lib/errors/application-error"
import { PermissionValue } from "@system/domain/iam/permission.value"
type Props = Readonly<{
  userId: string
  requesterHasSystemAdmin: boolean
  targetHasRootGrant: boolean
  user: Readonly<{ id: string; disabledAt: Date | null }> | null
  identities: ReadonlyArray<{
    id: string
    email: string | null
    passwordHash: string | null
    canReceiveEmail: boolean
  }>
}>

export class IssueInitialPassword {
  constructor(
    private readonly c: SystemDatabaseContext &
      SystemClockContext &
      SystemAuthorizationContext &
      SystemPasswordHashContext,
  ) {}

  static authorize(permissions: ReadonlySet<string>): ApplicationForbiddenError | null {
    return PermissionValue.hasAny(permissions, SystemPermission.IAM_WRITE)
      ? null
      : new ApplicationForbiddenError()
  }

  async execute(props: Props) {
    const authorizationError = IssueInitialPassword.authorize(this.c.var.permissions)

    if (authorizationError !== null) {
      return authorizationError
    }

    if (props.user === null) {
      return new AuthAccountNotFoundApplicationError(props.userId)
    }

    if (props.user.disabledAt !== null) {
      return new AuthAccountDisabledApplicationError(props.userId)
    }

    if (props.targetHasRootGrant && !props.requesterHasSystemAdmin) {
      return new RootGrantPasswordForbiddenApplicationError()
    }

    if (props.identities.length === 0) {
      return new PasswordIdentityMissingApplicationError(props.userId)
    }

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    const identity =
      props.identities.find((candidate) => !candidate.canReceiveEmail) ?? props.identities[0]
    const initialPassword = InitialPasswordGenerator.generate()
    const passwordHash = await PasswordHashService.hash(initialPassword, this.c.env.PEPPER_SECRET)
    const repository = new PasswordIdentityRepository(this.c)
    const writeResult = await repository.write(
      WriteOperationEntity.create("issue_initial_password", {
        identityId: identity.id,
        accountId: props.user.id,
        actorAccountId: this.c.var.userId,
        auditRole: this.c.var.role,
        passwordHash,
        writtenAt: this.c.var.now(),
      }),
    )

    if (writeResult instanceof PasswordIdentityWriteError) {
      return new SystemAuthPersistenceApplicationError(writeResult)
    }

    return {
      email: identity.email,
      initialPassword,
    }
  }
}
