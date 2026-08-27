import { createClient } from "@/lib/api/hc-client"

/**
 * GET /features。無効化されている機能キーの一覧を取得する。
 * 取得に失敗した場合は空配列（= 全機能表示）にフォールバックする。
 * 強制は api 側の feature gate（無効ルートは 404）が担うため、ここは表示の出し分け用。
 */
export async function getFeatureAvailability(): Promise<ReadonlyArray<string>> {
  const client = await createClient()

  const response = await client["company"]["features"].$get()

  if (response.status >= 400) {
    return []
  }

  const body = await response.json()

  return body.disabled_features
}
