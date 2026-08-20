import type { AccountId } from "@system/domain/auth/account-id"

/** Session発行Applicationが短命access tokenを作るためのSystem port。 */
export type SystemAccessTokenIssuer = Readonly<{
  issue(
    input: Readonly<{ accountId: AccountId; tokenVersion: number; now: Date }>,
  ): Promise<string | Error>
}>
