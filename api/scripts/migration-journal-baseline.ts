import { z } from "zod"

const schema = z
  .object({
    databaseId: z.string().min(1),
    appliedNames: z
      .array(z.string().regex(/^\d+_.*\.sql$/))
      .min(1)
      .readonly(),
    archivedNames: z
      .array(z.string().regex(/^\d+_.*\.sql$/))
      .min(1)
      .readonly(),
    schemaSha256: z.string().regex(/^[a-f0-9]{64}$/),
    backupSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .readonly()
type Props = z.infer<typeof schema>

/** 検証済みバックアップ時点の旧履歴を固定し、その後の未知の履歴を許可しない。 */
export class MigrationJournalBaseline {
  private constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  static create(input: unknown): MigrationJournalBaseline | Error {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return new Error("invalid migration baseline")
    const props = parsed.data
    if (
      new Set(props.appliedNames).size !== props.appliedNames.length ||
      new Set(props.archivedNames).size !== props.archivedNames.length ||
      props.archivedNames.some((name) => !props.appliedNames.includes(name))
    )
      return new Error("invalid migration baseline identities")
    return new MigrationJournalBaseline(props)
  }

  get databaseId(): string {
    return this.props.databaseId
  }

  verifyBackup(sha256: string): true | Error {
    if (sha256 !== this.props.backupSha256) return new Error("migration backup checksum mismatch")
    return true
  }

  inspect(input: {
    databaseId: string
    appliedNames: ReadonlyArray<string>
    localNames: ReadonlyArray<string>
    schemaSha256: string
  }): ReadonlyArray<string> | Error {
    if (new Set(input.appliedNames).size !== input.appliedNames.length)
      return new Error("duplicate migration filename")
    if (input.databaseId !== this.props.databaseId)
      return new Error("migration baseline belongs to another database")
    if (
      input.appliedNames.length < this.props.appliedNames.length ||
      this.props.appliedNames.some((name, index) => input.appliedNames[index] !== name)
    )
      return new Error("migration history differs from the verified baseline")
    if (this.props.archivedNames.some((name) => input.localNames.includes(name)))
      return new Error("archived migrations must not be executable local migrations")
    if (
      input.appliedNames.length === this.props.appliedNames.length &&
      input.schemaSha256 !== this.props.schemaSha256
    )
      return new Error("database schema differs from the verified baseline")
    const archived = new Set(this.props.archivedNames)
    return input.appliedNames.filter((name) => !archived.has(name))
  }
}
