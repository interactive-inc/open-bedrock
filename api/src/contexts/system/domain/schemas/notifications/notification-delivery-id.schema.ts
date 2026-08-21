import { z } from "zod"

export const notificationDeliveryIdSchema = z
  .string()
  .min(1)
  .max(255)
  .brand<"NotificationDeliveryId">()
export type NotificationDeliveryId = z.infer<typeof notificationDeliveryIdSchema>
