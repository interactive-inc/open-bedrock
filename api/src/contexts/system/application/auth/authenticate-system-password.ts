import type { PasswordCredentialRepository } from "@system/application/auth/password-credential-repository"
import type { SystemPasswordMaterialService } from "@system/application/auth/system-password-material-service"
import type { AccountId } from "@system/domain/auth/account-id"
import type { IdentityId } from "@system/domain/identity/identity-id"
import type { IdentitySubject } from "@system/domain/identity/identity-subject"

type Props = Readonly<{
  credentialRepository: PasswordCredentialRepository
  passwordMaterialService: SystemPasswordMaterialService
}>

export type AuthenticateSystemPasswordCommand = Readonly<{
  subject: IdentitySubject
  password: string
  now: Date
}>

export type AuthenticateSystemPasswordResult =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      identityId: IdentityId
      requiresPasswordRehash: boolean
      tokenVersion: number
    }>
  | Readonly<{ kind: "rejected"; reason: "invalid_credentials" }>

/**
 * Account・Identity・password credentialのcanonical状態だけでpassword認証を判定する。
 * Identity不在時も同じpassword検証コストを払い、列挙可能な時間差を作らない。
 */
export class AuthenticateSystemPassword {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(
    command: AuthenticateSystemPasswordCommand,
  ): Promise<AuthenticateSystemPasswordResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System password authentication time is invalid")
    }

    const credential = await this.props.credentialRepository.findBySubject(command.subject)
    if (credential instanceof Error) return credential

    const verified = await this.props.passwordMaterialService.verify(
      command.password,
      credential?.passwordHash ?? this.props.passwordMaterialService.dummyHash,
    )
    if (verified instanceof Error) return verified
    if (
      credential === null ||
      !verified ||
      credential.account.status !== "active" ||
      !credential.identity.wasActiveAt(command.now)
    ) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_credentials" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: credential.account.id,
      identityId: credential.identity.id,
      requiresPasswordRehash: this.props.passwordMaterialService.needsRehash(
        credential.passwordHash,
      ),
      tokenVersion: credential.account.tokenVersion,
    })
  }
}
