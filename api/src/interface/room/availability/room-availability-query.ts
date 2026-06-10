import { z } from "zod"

export const roomAvailabilityQuerySchema = z
  .object({
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    capacity: z.coerce.number().int().min(0).default(0),
  })
  .refine((data) => data.end_at > data.start_at, {
    message: "end_at must be after start_at",
    path: ["end_at"],
  })

export type RoomAvailabilityQuery = z.infer<typeof roomAvailabilityQuerySchema>
