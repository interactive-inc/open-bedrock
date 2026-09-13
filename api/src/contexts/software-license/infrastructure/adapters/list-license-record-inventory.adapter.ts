import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { z } from "zod"

const inventorySql =
  "SELECT json_group_array(id) AS ids_json FROM (SELECT id FROM software_licenses ORDER BY id)"

type Context = SoftwareLicenseContext

/** 撤去対象の全台帳IDを取得し、取得中の追加・削除を保全確定時に検出する。 */
export class ListLicenseRecordInventoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare() {
    const actor = await new LicenseActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ ids_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(inventorySql),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("license inventory is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.ids_json
      if (snapshot === undefined) return new Error("license inventory is unavailable")
      const ids = z
        .array(z.number().int().positive().safe())
        .readonly()
        .safeParse(JSON.parse(snapshot))
      if (!ids.success) return ids.error
      return Object.freeze({
        licenseIds: ids.data,
        assertions: Object.freeze([
          ...actor.assertions,
          this.c.env.DB.prepare(
            `SELECT CASE WHEN (SELECT ids_json FROM (${inventorySql})) IS ?1 THEN 1 ELSE json_extract('', '$') END`,
          ).bind(snapshot),
        ]),
      })
    } catch (cause) {
      return new Error("license inventory lookup failed", { cause })
    }
  }
}
