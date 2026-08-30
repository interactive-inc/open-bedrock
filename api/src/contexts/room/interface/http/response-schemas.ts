import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 会議室マスタ 1 件のレスポンス。 */
export const zAppRoom = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  location: z.string().nullable(),
})

/** 会議室マスタ一覧のレスポンス。 */
export const zAppRoomList = z.object({
  data: z.array(zAppRoom),
  total: z.number(),
})

/** 会議室予約 1 件のレスポンス。 */
export const zAppRoomReservation = z.object({
  id: z.string(),
  room_id: z.number(),
  reserver_id: zEmployeeId,
  start_at: z.string(),
  end_at: z.string(),
  purpose: z.string().nullable(),
})

/** 会議室予約一覧のレスポンス。 */
export const zAppRoomReservationList = z.object({
  data: z.array(zAppRoomReservation),
  total: z.number(),
})

/** 会議室空き状況 1 件のレスポンス。conflicts のフィールドは camelCase。 */
export const zAppRoomAvailability = z.object({
  room: z.object({
    id: z.number(),
    name: z.string(),
    capacity: z.number(),
  }),
  available: z.boolean(),
  conflicts: z.array(
    z.object({
      startAt: z.string(),
      endAt: z.string(),
      purpose: z.string().nullable(),
    }),
  ),
})

/** 会議室空き状況一覧のレスポンス。 */
export const zAppRoomAvailabilityList = z.object({
  data: z.array(zAppRoomAvailability),
  total: z.number(),
})
