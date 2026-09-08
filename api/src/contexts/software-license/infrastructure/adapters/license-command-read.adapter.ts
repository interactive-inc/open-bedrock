import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseEntity } from "@/contexts/software-license/domain/entities/license.entity"
import { z } from "zod"

type Context = Pick<SoftwareLicenseContext, "env">

/** 同じ記録者の登録完了結果を、現在の認可を再検査して返す。 */
export class LicenseCommandReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(
    input: Readonly<{
      accountId: string
      commandId: string
      assertions: ReadonlyArray<D1PreparedStatement>
    }>,
  ) {
    try {
      const reads = await this.c.env.DB.batch([
        ...input.assertions,
        this.c.env.DB.prepare(`SELECT request_json,after_json
        FROM software_license_changes WHERE actor_account_id=?1 AND command_id=?2`).bind(
          input.accountId,
          input.commandId,
        ),
      ])
      if (reads.some((read) => !read.success)) return new Error("license command is unavailable")
      const row = reads.at(-1)?.results[0]
      if (row === undefined) return null
      const recorded = z.object({ request_json: z.string(), after_json: z.string() }).parse(row)
      const license = LicenseEntity.restore(JSON.parse(recorded.after_json))
      if (license instanceof Error) return license
      return { requestJson: recorded.request_json, license }
    } catch (cause) {
      return new Error("license command is unavailable", { cause })
    }
  }
}
