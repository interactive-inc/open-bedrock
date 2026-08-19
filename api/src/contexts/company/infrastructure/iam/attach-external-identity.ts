import type { AccountId } from "@system/domain/auth/account-id"
import type { IdentityProvider } from "@system/domain/identity/identity-provider"
import { PrepareSystemIdentityAttachment } from "@system/infrastructure/identity/prepare-system-identity-attachment"
import type { Context } from "@/env"

/** machine provisioningで既存System Accountへ外部Identityを追加する。 */
export class AttachExternalIdentity {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: {
    accountId: AccountId
    provider: IdentityProvider
    subject: string
    email: string
    now: Date
  }): Promise<null | Error> {
    const prepared = new PrepareSystemIdentityAttachment({ env: { DB: this.c.env.DB } }).prepare(
      input,
    )
    if (prepared instanceof Error) return prepared

    try {
      await this.c.env.DB.batch([...prepared.statements])
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to attach external Identity")
    }
  }
}
