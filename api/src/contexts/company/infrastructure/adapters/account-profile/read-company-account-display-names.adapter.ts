type CompanyAccountDisplayNameRow = Readonly<{
  organization_id: string
  account_id: string
  display_name: string
}>

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

/**
 * Company が所有する表示名を、呼び出し元がアクセスできる organization の範囲だけで解決する。
 * 同一 Account が複数 organization に属する場合は organization ID の昇順で決定的に選ぶ。
 */
async function readCompanyAccountDisplayNames(
  props: Readonly<{
    database: D1Database
    organizationIds: ReadonlyArray<string>
    accountIds: ReadonlyArray<string>
  }>,
): Promise<ReadonlyMap<string, string>> {
  const accountIds = [...new Set(props.accountIds)].sort()
  if (accountIds.length === 0 || props.organizationIds.length === 0) return new Map()

  const unrestricted = props.organizationIds.includes("*")
  const organizationIds = unrestricted ? [] : [...new Set(props.organizationIds)].sort()
  const result = new Map<string, string>()
  const organizationChunks = unrestricted ? [[]] : chunks(organizationIds, 40)

  for (const organizationChunk of organizationChunks) {
    const accountChunkSize = Math.max(1, 90 - organizationChunk.length)
    for (const accountChunk of chunks(accountIds, accountChunkSize)) {
      const accountPlaceholders = accountChunk.map(() => "?").join(", ")
      const organizationPredicate = unrestricted
        ? ""
        : ` AND organization_id IN (${organizationChunk.map(() => "?").join(", ")})`
      const rows = await props.database
        .prepare(
          `SELECT organization_id, account_id, display_name
             FROM company_account_profiles
            WHERE account_id IN (${accountPlaceholders})${organizationPredicate}
            ORDER BY organization_id, account_id`,
        )
        .bind(...accountChunk, ...organizationChunk)
        .all<CompanyAccountDisplayNameRow>()

      for (const row of rows.results) {
        if (!result.has(row.account_id)) result.set(row.account_id, row.display_name)
      }
    }
  }

  return result
}
type ReadCompanyAccountDisplayNamesAdapterContext = Readonly<{
  database: D1Database
  organizationIds: ReadonlyArray<string>
  accountIds: ReadonlyArray<string>
}>
type Context = ReadCompanyAccountDisplayNamesAdapterContext

export class ReadCompanyAccountDisplayNamesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readCompanyAccountDisplayNames(): Promise<ReadonlyMap<string, string>> {
    return readCompanyAccountDisplayNames(this.c)
  }
}
