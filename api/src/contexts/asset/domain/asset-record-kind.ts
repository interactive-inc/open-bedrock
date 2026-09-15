import { z } from "zod"

export const assetRecordKinds = [
  "asset-record",
  "asset-lending-record",
  "stocktake-record",
  "stocktake-item-record",
] as const

export const assetRecordKindSchema = z.enum(assetRecordKinds)
export type AssetRecordKind = z.infer<typeof assetRecordKindSchema>

export function encodeStocktakeItemRecordId(stocktakeId: string, assetCode: string): string {
  return `${encodeURIComponent(stocktakeId)}:${encodeURIComponent(assetCode)}`
}

export function decodeStocktakeItemRecordId(recordId: string) {
  const separator = recordId.indexOf(":")
  if (separator < 1 || separator === recordId.length - 1) return null
  try {
    const stocktakeId = decodeURIComponent(recordId.slice(0, separator))
    const assetCode = decodeURIComponent(recordId.slice(separator + 1))
    return stocktakeId === "" || assetCode === "" ? null : { stocktakeId, assetCode }
  } catch {
    return null
  }
}
