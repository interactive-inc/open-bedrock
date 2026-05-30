import { z } from "zod"

export const notificationSearchQuerySchema = z.object({
  isRead: z.boolean().nullable(),
  limit: z.number().nullable(),
})

export type NotificationSearchQuery = z.infer<typeof notificationSearchQuerySchema>
