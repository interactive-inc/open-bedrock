import { z } from "zod"

export const governanceResponsibilityCutoverReceiptSchema = z.object({
  freeze_id: z.string().uuid(),
  source_count: z.number().int().nonnegative(),
  adopted_count: z.number().int().nonnegative(),
  source_manifest_digest: z.string().regex(/^[0-9a-f]{64}$/),
  completed_at: z.number().int().nonnegative(),
})

export const governanceResponsibilityManifestEntrySchema = z.object({
  sourceId: z.string().min(1),
  sourceVersion: z.string().regex(/^[0-9a-f]{64}$/),
})
