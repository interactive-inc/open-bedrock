/** runtimeや上位contextに依存しない認可済みAccount view。 */
export type SystemAuthorization<AccountId extends string | number = string> = Readonly<{
  accountId: AccountId
  permissions: ReadonlySet<string>
  hasPermission(permission: string): boolean
}>
