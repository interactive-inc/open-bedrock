import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { zAccountId } from "@system/domain/auth/account-id"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { AccountTokenCollectionValue } from "@/contexts/system/domain/auth/account-token-collection.value"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"
import {
  JwtSecretMissingApplicationError,
  PasswordResetRequestApplicationError,
  PasswordResetTokenExpiredApplicationError,
  PasswordResetTokenInvalidApplicationError,
  PasswordResetTokenUsedApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { PasswordResetCompletionWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordResetCompletionRepository } from "@/contexts/system/infrastructure/auth/password-reset-completion.repository"
import { resolveExistingAccountTokens } from "@/contexts/system/infrastructure/auth/resolve-existing-account-tokens"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemJwtSecretContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
type PasswordResetTokenItem = Readonly<{
  id: string
  userId: string
  identityId: string | null
  expiresAt: Date
  usedAt: Date | null
}>

type Props = Readonly<{
  resetToken: PasswordResetTokenItem | null
  newPassword: string
  accountsCookie: string | undefined
  identities: ReadonlyArray<{
    id: string
    email: string | null
    providerSubject: string
    emailVerifiedAt: Date | null
    user: { id: string; name: string; disabledAt: Date | null } | null
  }>
}>

export class ResetPassword {
  static readonly featureId = "00450023"

  constructor(
    private readonly c: SystemDatabaseContext &
      SystemClockContext &
      SystemJwtSecretContext &
      SystemPasswordHashContext,
  ) {}

  async execute(props: Props) {
    const resetToken = props.resetToken

    if (resetToken === null) {
      return new PasswordResetTokenInvalidApplicationError()
    }

    if (resetToken.usedAt !== null) {
      return new PasswordResetTokenUsedApplicationError()
    }

    const now = this.c.var.now()

    if (resetToken.expiresAt.getTime() < now.getTime()) {
      return new PasswordResetTokenExpiredApplicationError()
    }

    const identity =
      resetToken.identityId !== null
        ? (props.identities.find((candidate) => candidate.id === resetToken.identityId) ?? null)
        : props.identities.length === 1
          ? props.identities[0]
          : null

    if (identity === null || identity === undefined) {
      return new PasswordResetTokenInvalidApplicationError()
    }

    if (identity.user === null || identity.user.disabledAt !== null) {
      return new PasswordResetTokenInvalidApplicationError()
    }

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    const jwtSecret = this.c.env.JWT_SECRET as string | undefined
    if (jwtSecret === undefined || jwtSecret === "") {
      return new JwtSecretMissingApplicationError()
    }

    const passwordHash = await PasswordHashService.hash(props.newPassword, this.c.env.PEPPER_SECRET)
    const writeResult = await new PasswordResetCompletionRepository(this.c).write(
      WriteOperationEntity.create("complete", {
        tokenId: resetToken.id,
        tokenIdentityId: resetToken.identityId,
        userId: resetToken.userId,
        identityId: identity.id,
        passwordHash,
        emailVerifiedAt: identity.emailVerifiedAt ?? now,
        changedAt: now,
      }),
    )

    if (writeResult instanceof PasswordResetCompletionWriteError) {
      return new PasswordResetRequestApplicationError(writeResult)
    }

    if (writeResult === null) {
      return new PasswordResetTokenUsedApplicationError()
    }

    const accountId = zAccountId.safeParse(resetToken.userId)
    if (accountId.success === false) {
      return new SystemAuthPersistenceApplicationError()
    }
    const canonicalSession = await resolveAccountSession({
      accountRepository: new SystemAccountRepository({ database: this.c.var.database }),
      accountId: accountId.data,
      sessionTokenVersion: writeResult,
    })

    if (canonicalSession instanceof Error || canonicalSession.kind === "rejected") {
      return new SystemAuthPersistenceApplicationError(
        canonicalSession instanceof Error ? canonicalSession : undefined,
      )
    }

    const sessionToken = await SessionTokenService.create(
      resetToken.userId,
      jwtSecret,
      canonicalSession.account.tokenVersion,
    )
    const existingTokens = await resolveExistingAccountTokens(props.accountsCookie, jwtSecret)
    const accountTokens = AccountTokenCollectionValue.upsert(
      existingTokens,
      {
        userId: resetToken.userId,
        token: sessionToken,
      },
      AccountTokenCollectionValue.MAX_ACCOUNTS,
    )

    return {
      sessionToken,
      accountTokens,
      account: {
        userId: identity.user.id,
        email: identity.email ?? identity.providerSubject,
        name: identity.user.name,
      },
    }
  }
}
