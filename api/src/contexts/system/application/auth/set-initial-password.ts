import { PasswordHashService } from "@/contexts/system/infrastructure/auth/password-hash.service"
import {
  InternalRootGrantPasswordForbiddenApplicationError,
  PasswordAlreadySetApplicationError,
  PasswordIdentityNotFoundApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/auth/errors"
import { PasswordIdentityWriteError } from "@/contexts/system/infrastructure/auth/errors"
import { PasswordIdentityRepository } from "@/contexts/system/infrastructure/auth/password-identity.repository"
import type {
  SystemClockContext,
  SystemDatabaseContext,
  SystemPasswordHashContext,
} from "@system/infrastructure/configuration/system-context"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
type Props = Readonly<{
  userId: string
  password: string
  targetHasRootGrant: boolean
  identities: ReadonlyArray<{
    id: string
    email: string | null
    passwordHash: string | null
    canReceiveEmail: boolean
  }>
}>

export class SetInitialPassword {
  constructor(
    private readonly c: SystemDatabaseContext & SystemClockContext & SystemPasswordHashContext,
  ) {}

  async execute(props: Props) {
    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    if (props.targetHasRootGrant) {
      return new InternalRootGrantPasswordForbiddenApplicationError(props.userId)
    }

    if (props.identities.length === 0) {
      return new PasswordIdentityNotFoundApplicationError(props.userId)
    }

    const unsetIdentity = props.identities.find((identity) => identity.passwordHash === null)

    if (unsetIdentity === undefined) {
      return new PasswordAlreadySetApplicationError(props.userId)
    }

    const now = this.c.var.now()
    const passwordHash = await PasswordHashService.hash(props.password, this.c.env.PEPPER_SECRET)
    const repository = new PasswordIdentityRepository(this.c)
    const writeResult = await repository.write(
      WriteOperationEntity.create("set_initial_password_if_unset", {
        identityId: unsetIdentity.id,
        accountId: props.userId,
        // audit_logs.user_id は現行schemaでNOT NULL。内部同期は対象accountを主体として記録し、
        // source metadata と system role で人の操作と区別する。
        actorAccountId: props.userId,
        auditRole: "system",
        passwordHash,
        writtenAt: now,
      }),
    )

    if (writeResult instanceof PasswordIdentityWriteError) {
      return new SystemAuthPersistenceApplicationError(writeResult)
    }

    return { ok: true as const }
  }
}
