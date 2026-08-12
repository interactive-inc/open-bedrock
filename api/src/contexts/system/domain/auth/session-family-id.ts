import { z } from "zod"

/** RotationされたSessionを一括失効するためのopaque family ID。 */
export const zSessionFamilyId = z.string().min(1).max(255).brand<"SessionFamilyId">()

export type SessionFamilyId = z.infer<typeof zSessionFamilyId>
