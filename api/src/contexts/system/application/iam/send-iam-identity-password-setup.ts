import { SystemPermission } from "@system/domain/iam/system-permission.catalog"
import { SecureTokenGenerator } from "@/contexts/system/infrastructure/auth/secure-token.generator"
import {
  IamApplicationError,
  IamAssignmentForbiddenApplicationError,
  IamIdentityNotFoundApplicationError,
  InvalidIamIdentityApplicationError,
} from "@/contexts/system/application/iam/errors"
import { PasswordResetTokenEntity } from "@/contexts/system/domain/auth/password-reset-token.entity"
import { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import { IdValue } from "@/lib/identity/id.value"
import { IdentityPasswordSetupEmailGateway } from "@/contexts/system/infrastructure/auth/identity-password-setup-email.gateway"
import { PasswordResetTokenRepository } from "@/contexts/system/infrastructure/auth/password-reset-token.repository"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemDatabaseContext,
  SystemEmailContext,
} from "@system/infrastructure/configuration/system-context"

const passwordSetupTokenExpiresMilliseconds = 3 * 24 * 60 * 60 * 1000
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
  origin: string
  identity: IamIdentityItem | null
  targetHoldsRoot: boolean
  accountDisabledAt: Date | null | undefined
}>

export class SendIamIdentityPasswordSetup {
  static readonly featureId = "00570002"

  constructor(
    private readonly c: SystemDatabaseContext &
      SystemClockContext &
      SystemAuthorizationContext &
      SystemEmailContext,
  ) {}

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
          "他のアカウントへパスワード設定メールを送る権限がありません。",
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
    const authorizationError = SendIamIdentityPasswordSetup.authorize(
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
        "システム管理者へ設定メールを送れるのはシステム管理者だけです。",
      )
    }

    if (identity.provider !== "password" || identity.email === null || !identity.canReceiveEmail) {
      return new InvalidIamIdentityApplicationError(
        "identity.email_unavailable",
        "このログイン方法にはパスワード設定メールを送れません。",
      )
    }

    if (props.accountDisabledAt === undefined) {
      return new IamApplicationError(new Error("iam_account_not_found"))
    }

    if (props.accountDisabledAt !== null) {
      return new InvalidIamIdentityApplicationError(
        "account.disabled",
        "無効化されたアカウントには設定メールを送れません。",
      )
    }

    const now = this.c.var.now()
    const resetToken = SecureTokenGenerator.generate()
    const token = PasswordResetTokenEntity.create({
      id: IdValue.create().toString(),
      token: resetToken,
      userId: identity.userId,
      identityId: identity.id,
      expiresAt: new Date(now.getTime() + passwordSetupTokenExpiresMilliseconds),
      usedAt: null,
      createdAt: now,
    })

    if (token instanceof Error) {
      return new IamApplicationError(token)
    }

    const writeResult = await new PasswordResetTokenRepository(this.c).write(token)

    if (writeResult instanceof Error) {
      return new IamApplicationError(writeResult)
    }

    const emailResult = await new IdentityPasswordSetupEmailGateway(this.c).send({
      to: identity.email,
      origin: props.origin,
      token: resetToken,
    })

    if (emailResult instanceof Error) {
      console.error("identity.password_setup_email_failed", identity.id, emailResult)
    }

    return {
      item: { identityId: identity.id },
      delivery: emailResult instanceof Error ? ("failed" as const) : emailResult,
    }
  }
}
