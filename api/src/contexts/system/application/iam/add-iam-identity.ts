import { SystemPermission } from "@system/domain/iam/system-permission.catalog"
import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { SecureTokenGenerator } from "@/contexts/system/infrastructure/auth/secure-token.generator"
import {
  IamAccountNotFoundApplicationError,
  IamApplicationError,
  IamAssignmentForbiddenApplicationError,
  InvalidIamIdentityApplicationError,
} from "@/contexts/system/application/iam/errors"
import { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import { PasswordResetTokenEntity } from "@/contexts/system/domain/auth/password-reset-token.entity"
import { IdValue } from "@/lib/identity/id.value"
import { IamIdentityDuplicateError } from "@/contexts/system/infrastructure/iam/errors"
import { IamIdentityRepository } from "@/contexts/system/infrastructure/iam/iam-identity.repository"
import { IdentityPasswordSetupEmailGateway } from "@/contexts/system/infrastructure/auth/identity-password-setup-email.gateway"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
import { withEntityWriteState } from "@/lib/persistence/entity-write-state.service"

const passwordSetupTokenExpiresMilliseconds = 3 * 24 * 60 * 60 * 1000
type Props = Readonly<{
  userId: string
  email: string
  currentPassword?: string | null
  origin: string
  accountExists: boolean
  targetHoldsRoot: boolean
  duplicateExists: boolean
  configuredPasswordHashes: ReadonlyArray<string>
}>

export class AddIamIdentity {
  static readonly featureId = "00570001"

  constructor(
    private readonly c: SystemDatabaseContext &
      SystemClockContext &
      SystemAuthorizationContext &
      SystemEmailContext &
      SystemPasswordHashContext,
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
          "他のアカウントへログイン方法を追加する権限がありません。",
        )
  }

  async execute(props: Props) {
    const isSelf = this.c.var.userId === props.userId
    const authorizationError = AddIamIdentity.authorize(
      this.c.var.userId,
      props.userId,
      this.c.var.permissions,
    )

    if (authorizationError !== null) {
      return authorizationError
    }

    if (!props.accountExists) {
      return new IamAccountNotFoundApplicationError()
    }

    if (
      !isSelf &&
      props.targetHoldsRoot &&
      !this.c.var.permissions.has(SystemPermission.SYSTEM_ADMIN.key)
    ) {
      return new IamAssignmentForbiddenApplicationError(
        "iam.root_grant_forbidden",
        "システム管理者のログイン方法を追加できるのはシステム管理者だけです。",
      )
    }

    if (props.duplicateExists) {
      return new InvalidIamIdentityApplicationError(
        "identity.email_already_used",
        "このメールアドレスは既に登録されています。",
      )
    }

    if (isSelf) {
      if (props.configuredPasswordHashes.length > 0) {
        if (!props.currentPassword) {
          return new InvalidIamIdentityApplicationError(
            "current_password_required",
            "本人確認のため現在のパスワードを入力してください。",
          )
        }

        if (this.c.env.PEPPER_SECRET === undefined) {
          return new IamApplicationError(new Error("pepper_secret_missing"))
        }

        let valid = false

        for (const passwordHash of props.configuredPasswordHashes) {
          if (
            await PasswordHashService.verify(
              props.currentPassword,
              passwordHash,
              this.c.env.PEPPER_SECRET,
            )
          ) {
            valid = true
            break
          }
        }

        if (!valid) {
          return new InvalidIamIdentityApplicationError(
            "current_password_incorrect",
            "現在のパスワードが正しくありません。",
          )
        }
      }
    }

    const now = this.c.var.now()
    const identity = IamIdentityEntity.create({
      id: IdValue.create().toString(),
      userId: props.userId,
      provider: "password",
      providerSubject: props.email,
      email: props.email,
      passwordHash: null,
      canReceiveEmail: true,
      emailVerifiedAt: null,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    if (identity instanceof Error) {
      return new InvalidIamIdentityApplicationError(
        "identity.invalid",
        "メールアドレスを確認してください。",
        identity,
      )
    }

    const resetToken = SecureTokenGenerator.generate()
    const token = PasswordResetTokenEntity.create({
      id: IdValue.create().toString(),
      token: resetToken,
      userId: props.userId,
      identityId: identity.id,
      expiresAt: new Date(now.getTime() + passwordSetupTokenExpiresMilliseconds),
      usedAt: null,
      createdAt: now,
    })

    if (token instanceof Error) {
      return new IamApplicationError(token)
    }

    const repository = new IamIdentityRepository(this.c)
    const writeResult = await repository.write(
      withEntityWriteState(identity, { passwordResetTokenEntity: token }),
    )

    if (writeResult instanceof IamIdentityDuplicateError) {
      return new InvalidIamIdentityApplicationError(
        "identity.email_already_used",
        "このメールアドレスは既に登録されています。",
        writeResult,
      )
    }

    if (writeResult instanceof Error) {
      return new IamApplicationError(writeResult)
    }

    const emailResult = await new IdentityPasswordSetupEmailGateway(this.c).send({
      to: props.email,
      origin: props.origin,
      token: resetToken,
    })

    if (emailResult instanceof Error) {
      console.error("identity.password_setup_email_failed", writeResult.id, emailResult)
    }

    return {
      identityId: writeResult.id,
      delivery: emailResult instanceof Error ? ("failed" as const) : emailResult,
    }
  }
}
