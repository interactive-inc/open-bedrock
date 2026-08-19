import {
  identityProviderSchema,
  type IdentityProvider,
} from "@system/domain/identity/identity-provider"
import {
  identitySubjectSchema,
  type IdentitySubject,
} from "@system/domain/identity/identity-subject"
import { InvalidIamIdentityError } from "@/contexts/system/domain/identity/invalid-iam-identity.error"
import { z } from "zod"

const zProps = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  provider: identityProviderSchema,
  providerSubject: identitySubjectSchema,
  email: z.string().nullable(),
  passwordHash: z.string().nullable(),
  canReceiveEmail: z.boolean(),
  emailVerifiedAt: z.date().nullable(),
  passwordChangedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class IamIdentityEntity {
  readonly id: string
  readonly userId: string
  readonly provider: IdentityProvider
  readonly providerSubject: IdentitySubject
  readonly email: string | null
  readonly passwordHash: string | null
  readonly canReceiveEmail: boolean
  readonly emailVerifiedAt: Date | null
  readonly passwordChangedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor(props: z.input<typeof zProps>) {
    const parsed = zProps.parse(props)

    this.id = parsed.id
    this.userId = parsed.userId
    this.provider = parsed.provider
    this.providerSubject = parsed.providerSubject
    this.email = parsed.email
    this.passwordHash = parsed.passwordHash
    this.canReceiveEmail = parsed.canReceiveEmail
    this.emailVerifiedAt = parsed.emailVerifiedAt
    this.passwordChangedAt = parsed.passwordChangedAt
    this.createdAt = parsed.createdAt
    this.updatedAt = parsed.updatedAt

    Object.freeze(this)
  }

  static create(input: unknown): IamIdentityEntity | InvalidIamIdentityError {
    const parsed = zProps.safeParse(input)

    if (!parsed.success) {
      return new InvalidIamIdentityError(parsed.error)
    }

    return new IamIdentityEntity(parsed.data)
  }

  isConfiguredLogin() {
    return this.provider !== "password" || this.passwordHash !== null
  }
}
