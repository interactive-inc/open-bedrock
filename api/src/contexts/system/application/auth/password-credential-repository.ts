import type { Account } from "@system/domain/auth/account.entity"
import type { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import type { IdentitySubject } from "@system/domain/identity/identity-subject"

export type SystemPasswordCredential = Readonly<{
  account: Account
  identity: IdentityBinding
  passwordHash: string
}>

/** password secretをIdentity・Accountと同じcanonical境界から読むport。 */
export type PasswordCredentialRepository = Readonly<{
  findBySubject: (subject: IdentitySubject) => Promise<SystemPasswordCredential | null | Error>
}>
