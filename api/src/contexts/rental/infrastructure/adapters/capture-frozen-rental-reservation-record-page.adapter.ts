import { z } from "zod"
import type { RentalReservationContext } from "@/contexts/rental/configuration/rental-context"
import { ListFrozenRentalReservationRecordPageAdapter } from "@/contexts/rental/infrastructure/adapters/list-frozen-rental-reservation-record-page.adapter"
import { CaptureRentalReservationRecordAdapter } from "@/contexts/rental/infrastructure/adapters/capture-rental-reservation-record.adapter"

type Context = RentalReservationContext
const requestSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  afterId: z.uuid().nullable(),
  limit: z.number().int().min(1).max(10),
})

/** 停止したrental reservation記録の原文を分割取得し、全取得後と後続保存時にも同じ停止世代を検査する。 */
export class CaptureFrozenRentalReservationRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const page = await new ListFrozenRentalReservationRecordPageAdapter(this.c).prepare(request)
    if (page instanceof Error) return page
    const records = []
    for (const recordId of page.recordIds) {
      const record = await new CaptureRentalReservationRecordAdapter(this.c).prepare({
        rentalReservationId: recordId,
        sourceNamespace: request.sourceNamespace,
      })
      if (record instanceof Error) return record
      records.push(record)
    }
    // 停止中は業務DBの全writerが拒否されるため、末尾で世代を確認すれば途中の解除も検知できる。
    try {
      const checks = await this.c.env.DB.batch([...page.assertions])
      if (checks.length !== page.assertions.length || checks.some((check) => !check.success))
        return new Error("frozen rental capture changed")
    } catch (cause) {
      return new Error("frozen rental capture changed", { cause })
    }
    return Object.freeze({
      freezeId: page.freezeId,
      afterId: request.afterId,
      nextAfterId: page.nextAfterId,
      records: Object.freeze(records),
      assertions: page.assertions,
    })
  }
}
