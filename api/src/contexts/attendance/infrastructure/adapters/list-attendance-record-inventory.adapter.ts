import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { AttendanceRecordSourceAuthorizationAdapter } from "@/contexts/attendance/infrastructure/adapters/attendance-record-source-authorization.adapter"
import { z } from "zod"

const inventorySql =
  "SELECT json_group_array(id) AS ids_json FROM (SELECT id FROM attendance_records ORDER BY id)"

/** 状態で除外せず全打刻IDを取得し、対象の追加と削除を検出する。 */
export class ListAttendanceRecordInventoryAdapter {
  constructor(private readonly c: AttendanceRecordSourceContext) {
    Object.freeze(this)
  }

  async prepare() {
    const actor = await new AttendanceRecordSourceAuthorizationAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ ids_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(inventorySql),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("attendance inventory is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.ids_json
      if (snapshot === undefined) return new Error("attendance inventory is unavailable")
      const ids = z
        .array(z.number().int().positive().safe())
        .readonly()
        .safeParse(JSON.parse(snapshot))
      if (!ids.success) return ids.error
      return Object.freeze({
        recordIds: ids.data,
        assertions: Object.freeze([
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
            (SELECT ids_json FROM (${inventorySql})) IS ?1
            THEN 1 ELSE json_extract('{}', 'attendance_inventory_changed') END`).bind(snapshot),
        ]),
      })
    } catch (cause) {
      return new Error("attendance inventory lookup failed", { cause })
    }
  }
}
