import { z } from "zod"

export const roomAvailabilityQuerySchema = z.object({
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  capacity: z.coerce.number().int().min(0).default(0),
})

export type RoomAvailabilityQuery = z.infer<typeof roomAvailabilityQuerySchema>
