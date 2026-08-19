import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { zAccountId } from "@system/domain/auth/account-id"
import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import { AccountTokenCollectionValue } from "@/contexts/system/domain/auth/account-token-collection.value"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"
import {
  AuthAccountNotFoundApplicationError,
  CurrentPasswordIncorrectApplicationError,
  JwtSecretMissingApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { PasswordIdentityWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordIdentityRepository } from "@/contexts/system/infrastructure/auth/password-identity.repository"
import { resolveExistingAccountTokens } from "@/contexts/system/infrastructure/auth/resolve-existing-account-tokens"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemJwtSecretContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
type Props = Readonly<{
  userId: string
  currentPassword: string
  newPassword: string
  role: string
  accountsCookie: string | undefined
  user: Readonly<{ id: string; disabledAt: Date | null }> | null
  identities: ReadonlyArray<{
    id: string
    email: string | null
    passwordHash: string | null
    canReceiveEmail: boolean
  }>
}>

export class ChangePassword {
  constructor(
    private readonly c: SystemDatabaseContext &
      SystemClockContext &
      SystemJwtSecretContext &
      SystemPasswordHashContext,
  ) {}

  async execute(props: Props) {
    if (props.user === null) {
      return new AuthAccountNotFoundApplicationError(props.userId)
    }

    const identity = props.identities[0]

    if (identity === undefined || identity.passwordHash === null) {
      return new CurrentPasswordIncorrectApplicationError()
    }

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    let currentPasswordIsValid = false

    try {
      currentPasswordIsValid = await PasswordHashService.verify(
        props.currentPassword,
        identity.passwordHash,
        this.c.env.PEPPER_SECRET,
      )
    } catch {
      currentPasswordIsValid = false
    }

    if (!currentPasswordIsValid) {
      return new CurrentPasswordIncorrectApplicationError()
    }

    const jwtSecret = this.c.env.JWT_SECRET as string | undefined
    if (jwtSecret === undefined || jwtSecret === "") {
      return new JwtSecretMissingApplicationError()
    }

    const changedAt = this.c.var.now()
    const passwordHash = await PasswordHashService.hash(props.newPassword, this.c.env.PEPPER_SECRET)
    const repository = new PasswordIdentityRepository(this.c)
    const writeResult = await repository.write(
      WriteOperationEntity.create("change_password", {
        identityId: identity.id,
        accountId: props.user.id,
        actorAccountId: props.user.id,
        passwordHash,
        writtenAt: changedAt,
        auditRole: props.role,
      }),
    )

    if (writeResult instanceof PasswordIdentityWriteError) {
      return new SystemAuthPersistenceApplicationError(writeResult)
    }

    const accountId = zAccountId.safeParse(props.user.id)
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

    const token = await SessionTokenService.create(
      props.user.id,
      jwtSecret,
      canonicalSession.account.tokenVersion,
    )
    const existingTokens = await resolveExistingAccountTokens(props.accountsCookie, jwtSecret)
    const accountTokens = AccountTokenCollectionValue.upsert(
      existingTokens,
      {
        userId: props.user.id,
        token,
      },
      AccountTokenCollectionValue.MAX_ACCOUNTS,
    )

    return {
      userId: props.user.id,
      token,
      accountTokens,
    }
  }
}
