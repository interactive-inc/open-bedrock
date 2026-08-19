import type { AccountId } from "@system/domain/auth/account-id"

export type IssueSystemAccessTokenInput = Readonly<{
  accountId: AccountId
  tokenVersion: number
  now: Date
}>

/** Session発行Applicationが短命access tokenを作るためのSystem port。 */
export type SystemAccessTokenIssuer = Readonly<{
  issue(input: IssueSystemAccessTokenInput): Promise<string | Error>
}>
