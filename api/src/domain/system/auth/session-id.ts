import { z } from "zod"

/** Adapterの採番方式を露出しないopaque Session ID。 */
export const zSessionId = z.string().min(1).max(255).brand<"SessionId">()

export type SessionId = z.infer<typeof zSessionId>
