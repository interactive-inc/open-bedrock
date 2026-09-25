import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"
import { roomRecordKindSchema } from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"

export const roomSourceFreezeResponseSchema = z.strictObject({
  freeze: recordSourceFreezeSnapshotSchema,
})

export const zAppRoomCoveragePageReceipt = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppRoomRetirementPlan = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(),
  recordKinds: z.array(roomRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppRoomRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(),
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(),
  checkedAt: z.iso.datetime(),
})
export const zAppRoomRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(),
  caseId: z.string().min(1),
  planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.string().min(1),
})
export const zAppRoomRetirementExecution = z.strictObject({
  retirement_id: z.uuid(),
  finalized_at: z.iso.datetime(),
})

/** 会議室マスタ 1 件のレスポンス。 */
export const zAppRoom = z.object({
  id: z.uuid(),
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
  room_id: z.uuid(),
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
    id: z.uuid(),
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
