export type AccountToken = Readonly<{ userId: string; token: string }>

export class AccountTokenCollectionValue {
  static parse(raw: string | undefined): ReadonlyArray<string> {
    if (!raw) {
      return []
    }

    return raw.split(AccountTokenCollectionValue.DELIMITER).filter((token) => token.length > 0)
  }

  static upsert(
    existing: ReadonlyArray<AccountToken>,
    next: AccountToken,
    maxAccounts: number = AccountTokenCollectionValue.MAX_ACCOUNTS,
  ): ReadonlyArray<string> {
    const kept = existing.filter((entry) => entry.userId !== next.userId)

    return [next, ...kept].slice(0, maxAccounts).map((entry) => entry.token)
  }

  static remove(tokens: ReadonlyArray<string>, target: string): ReadonlyArray<string> {
    return tokens.filter((token) => token !== target)
  }

  static readonly MAX_ACCOUNTS = 5
  static readonly DELIMITER = ","
}
