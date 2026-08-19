import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import {
  InternalAuthRateLimitedApplicationError,
  InvalidInternalCredentialsApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { PasswordIdentityWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordIdentityRepository } from "@/contexts/system/infrastructure/auth/password-identity.repository"
import { AuthAuditLogRepository } from "@/contexts/system/infrastructure/audit/auth-audit-log.repository"
import { LoginRateLimitService } from "@/contexts/system/infrastructure/auth/login-rate-limit.service"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"

type PasswordIdentityForVerification = Readonly<{
  id: string
  email: string | null
  providerSubject: string
  passwordHash: string | null
  user: { id: string; name: string; disabledAt: Date | null } | null
}>

type Props = Readonly<{
  userId: string
  password: string
  clientIp: string | null
  identities: ReadonlyArray<PasswordIdentityForVerification>
}>

export class VerifyInternalCredentials {
  private readonly dummyHash =
    "pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

  constructor(
    private readonly c: SystemDatabaseContext & SystemClockContext & SystemPasswordHashContext,
  ) {}

  async checkRateLimit(props: {
    clientIp: string | null
    userId: string
  }): Promise<
    InternalAuthRateLimitedApplicationError | SystemAuthPersistenceApplicationError | null
  > {
    const rateLimitKey = LoginRateLimitService.internalVerifyKey(props.clientIp, props.userId)
    const rateLimit = new LoginRateLimitService(this.c)

    try {
      if (await rateLimit.isLimited({ key: rateLimitKey })) {
        return new InternalAuthRateLimitedApplicationError()
      }
    } catch (cause) {
      return new SystemAuthPersistenceApplicationError(cause)
    }

    return null
  }

  async execute(props: Props) {
    const rateLimitKey = LoginRateLimitService.internalVerifyKey(props.clientIp, props.userId)
    const rateLimit = new LoginRateLimitService(this.c)

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    const matched = await this.findMatchingIdentity(
      props.identities,
      props.password,
      this.c.env.PEPPER_SECRET,
    )
    const existingUserId = props.identities[0]?.user?.id ?? null

    if (matched === null || matched.user === null) {
      try {
        await rateLimit.record({ key: rateLimitKey })

        if (matched === null && existingUserId !== null) {
          await new AuthAuditLogRepository(this.c).write(
            WriteOperationEntity.create("record", {
              userId: existingUserId,
              role: "unknown",
              action: "internal-verify:failed",
              resourceId: existingUserId,
              metadata: { reason: "invalid_credentials" },
            }),
          )
        }
      } catch (cause) {
        return new SystemAuthPersistenceApplicationError(cause)
      }

      return new InvalidInternalCredentialsApplicationError()
    }

    if (matched.user.disabledAt !== null) {
      return new InvalidInternalCredentialsApplicationError()
    }

    try {
      await rateLimit.reset({ key: rateLimitKey })
    } catch (cause) {
      return new SystemAuthPersistenceApplicationError(cause)
    }

    if (PasswordHashService.needsRehash(matched.passwordHash ?? "")) {
      const passwordHash = await PasswordHashService.hash(props.password, this.c.env.PEPPER_SECRET)
      const repository = new PasswordIdentityRepository(this.c)
      const writeResult = await repository.write(
        WriteOperationEntity.create("rehash_password", {
          identityId: matched.id,
          passwordHash,
          writtenAt: this.c.var.now(),
        }),
      )

      if (writeResult instanceof PasswordIdentityWriteError) {
        return new SystemAuthPersistenceApplicationError(writeResult)
      }
    }

    try {
      await new AuthAuditLogRepository(this.c).write(
        WriteOperationEntity.create("record", {
          userId: matched.user.id,
          role: "unknown",
          action: "internal-verify",
          resourceId: matched.user.id,
          metadata: null,
        }),
      )
    } catch (cause) {
      return new SystemAuthPersistenceApplicationError(cause)
    }

    return {
      item: {
        userId: matched.user.id,
        email: matched.email ?? matched.providerSubject,
        name: matched.user.name,
      },
    }
  }

  private async findMatchingIdentity(
    identities: ReadonlyArray<PasswordIdentityForVerification>,
    password: string,
    pepper: string,
  ): Promise<PasswordIdentityForVerification | null> {
    for (const identity of identities) {
      let valid = false

      try {
        valid = await PasswordHashService.verify(
          password,
          identity.passwordHash ?? this.dummyHash,
          pepper,
        )
      } catch {
        valid = false
      }

      if (valid) {
        return identity
      }
    }

    if (identities.length === 0) {
      try {
        await PasswordHashService.verify(password, this.dummyHash, pepper)
      } catch {
        return null
      }
    }

    return null
  }
}
