import { createReadStream, readdirSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { parseConfigFileTextToJson } from "typescript"
import { z } from "zod"
import { fetchRemoteD1Rows } from "./fetch-remote-d1-rows"
import { MigrationJournal } from "./migration-journal"
import { MigrationJournalBaseline } from "./migration-journal-baseline"
import { CompanyAccountLinkMigrationPreflight } from "./company-account-link-migration-preflight"

/** Read every configured D1 journal before allowing any remote DDL. */
export async function checkRemoteMigrationJournal(
  configPath: string,
  evidence?: { baselinePath: string; baselineSha256: string; backupPath: string },
): Promise<void> {
  const baselines = new Map<string, MigrationJournalBaseline>()
  if (evidence !== undefined) {
    const bytes = readFileSync(evidence.baselinePath)
    if (
      !/^[a-f0-9]{64}$/.test(evidence.baselineSha256) ||
      createHash("sha256").update(bytes).digest("hex") !== evidence.baselineSha256
    )
      throw new Error("migration baseline checksum mismatch")
    const baseline = MigrationJournalBaseline.create(JSON.parse(bytes.toString("utf8")))
    if (baseline instanceof Error) throw baseline
    const backupHash = createHash("sha256")
    for await (const chunk of createReadStream(evidence.backupPath)) backupHash.update(chunk)
    const verified = baseline.verifyBackup(backupHash.digest("hex"))
    if (verified instanceof Error) throw verified
    baselines.set(baseline.databaseId, baseline)
  }
  const parsed = parseConfigFileTextToJson(configPath, readFileSync(configPath, "utf8"))
  if (parsed.error !== undefined) throw new Error("invalid Wrangler JSON configuration")
  const config = z
    .object({
      migrations_dir: z.string().min(1).optional(),
      d1_databases: z
        .array(
          z.object({
            binding: z.string().min(1),
            database_id: z.string().min(1),
            migrations_dir: z.string().min(1).optional(),
          }),
        )
        .min(1),
    })
    .parse(parsed.config)
  for (const databaseId of baselines.keys()) {
    if (!config.d1_databases.some((database) => database.database_id === databaseId))
      throw new Error("migration baseline belongs to an unconfigured database")
  }
  const failures: string[] = []
  for (const database of config.d1_databases) {
    const directory = join(
      dirname(configPath),
      database.migrations_dir ?? config.migrations_dir ?? "migrations",
    )
    const localNames = readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort()
    if (localNames.length === 0) throw new Error(`no local migrations for ${database.binding}`)
    const rows = await fetchRemoteD1Rows({
      binding: database.binding,
      configPath,
      query: "SELECT name FROM d1_migrations ORDER BY id",
      allowMissingJournal: true,
    })
    if (rows === null || rows.length === 0) {
      const tables = await fetchRemoteD1Rows({
        binding: database.binding,
        configPath,
        query:
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name != 'd1_migrations'",
      })
      if (tables === null || tables.length !== 0) {
        throw new Error(`journal is missing or empty in a populated database: ${database.binding}`)
      }
    }
    const appliedNames = z
      .array(z.object({ name: z.string().min(1) }))
      .parse(rows ?? [])
      .map((row) => row.name)
    const baseline = baselines.get(database.database_id)
    const schemaRows =
      baseline === undefined
        ? []
        : await fetchRemoteD1Rows({
            binding: database.binding,
            configPath,
            query:
              "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' ORDER BY type, name",
          })
    const verifiedNames =
      baseline === undefined
        ? appliedNames
        : baseline.inspect({
            databaseId: database.database_id,
            appliedNames,
            localNames,
            schemaSha256: createHash("sha256").update(JSON.stringify(schemaRows)).digest("hex"),
          })
    if (verifiedNames instanceof Error) throw verifiedNames
    failures.push(
      ...MigrationJournal.inspect({ appliedNames: verifiedNames, localNames }).map(
        (failure) => `${database.binding}: ${failure}`,
      ),
    )
    if (appliedNames.length > 0) {
      const readiness = await new CompanyAccountLinkMigrationPreflight({
        appliedNames,
        localNames,
        migrationsDirectory: directory,
        query: (query) => fetchRemoteD1Rows({ binding: database.binding, configPath, query }),
      }).check()
      if (readiness instanceof Error) failures.push(`${database.binding}: ${readiness.message}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Migration preflight failed before applying DDL. Resolve the reported history conflicts and Company data preparation errors without rewriting the journal.\n${failures.join("\n")}`,
    )
  }
  console.log("Remote migration history and Company account-link preparation checks passed")
}

if (import.meta.main) {
  const arguments_ = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      config: { type: "string" },
      baseline: { type: "string" },
      "baseline-sha256": { type: "string" },
      backup: { type: "string" },
    },
    strict: true,
  })
  if (arguments_.values.config === undefined) throw new Error("--config is required")
  const values = {
    config: arguments_.values.config,
    baseline: arguments_.values.baseline ?? process.env.MIGRATION_JOURNAL_BASELINE_PATH,
    "baseline-sha256":
      arguments_.values["baseline-sha256"] ?? process.env.MIGRATION_JOURNAL_BASELINE_SHA256,
    backup: arguments_.values.backup ?? process.env.MIGRATION_JOURNAL_BACKUP_PATH,
  }
  if (
    values.baseline !== undefined ||
    values["baseline-sha256"] !== undefined ||
    values.backup !== undefined
  ) {
    if (
      values.baseline === undefined ||
      values["baseline-sha256"] === undefined ||
      values.backup === undefined
    )
      throw new Error("--baseline, --baseline-sha256 and --backup are required together")
    await checkRemoteMigrationJournal(values.config, {
      baselinePath: values.baseline,
      baselineSha256: values["baseline-sha256"],
      backupPath: values.backup,
    })
  } else {
    await checkRemoteMigrationJournal(values.config)
  }
}
