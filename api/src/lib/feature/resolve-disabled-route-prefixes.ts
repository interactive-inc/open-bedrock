import {
  optionalFeatureRoutePrefixes,
  standardFeatureRoutePrefixes,
} from "@/lib/feature/feature-route-registry"

export type Props = {
  enabledOptionalFeatures: string | undefined
  disabledStandardFeatures: string | undefined
}

/** カンマ区切りの機能キーを集合にする。未知のキーは無視する（typo は既定側に倒れる）。 */
function toFeatureKeySet(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  )
}

/**
 * 環境変数から、無効な機能の API ルート接頭辞一覧を解決する。
 * company-optional は既定で無効（ENABLED_OPTIONAL_FEATURES で "all" か有効にするキーを指定する）。
 * company-standard は既定で有効（DISABLED_STANDARD_FEATURES で無効にするキーを指定する）。
 */
export function resolveDisabledRoutePrefixes(props: Props): ReadonlyArray<string> {
  const disabledPrefixes: Array<string> = []

  const enabledRaw = props.enabledOptionalFeatures?.trim() ?? ""

  if (enabledRaw !== "all") {
    const enabledKeys =
      enabledRaw === "" || enabledRaw === "none" ? new Set<string>() : toFeatureKeySet(enabledRaw)

    for (const [featureKey, routePrefixes] of Object.entries(optionalFeatureRoutePrefixes)) {
      if (enabledKeys.has(featureKey) === false) {
        disabledPrefixes.push(...routePrefixes)
      }
    }
  }

  const disabledRaw = props.disabledStandardFeatures?.trim() ?? ""

  if (disabledRaw !== "") {
    const disabledKeys =
      disabledRaw === "all"
        ? new Set(Object.keys(standardFeatureRoutePrefixes))
        : toFeatureKeySet(disabledRaw)

    for (const [featureKey, routePrefixes] of Object.entries(standardFeatureRoutePrefixes)) {
      if (disabledKeys.has(featureKey)) {
        disabledPrefixes.push(...routePrefixes)
      }
    }
  }

  return disabledPrefixes
}
