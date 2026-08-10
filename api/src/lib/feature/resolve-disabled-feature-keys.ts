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
 * 環境変数から、無効な機能キーの一覧を解決する。
 * company-optional は既定で無効（ENABLED_OPTIONAL_FEATURES で "all" か有効にするキーを指定する）。
 * company-standard は既定で有効（DISABLED_STANDARD_FEATURES で無効にするキーを指定する）。
 */
export function resolveDisabledFeatureKeys(props: Props): ReadonlyArray<string> {
  const disabledKeys: Array<string> = []

  const enabledRaw = props.enabledOptionalFeatures?.trim() ?? ""

  if (enabledRaw !== "all") {
    const enabledKeys =
      enabledRaw === "" || enabledRaw === "none" ? new Set<string>() : toFeatureKeySet(enabledRaw)

    for (const featureKey of Object.keys(optionalFeatureRoutePrefixes)) {
      if (enabledKeys.has(featureKey) === false) {
        disabledKeys.push(featureKey)
      }
    }
  }

  const disabledRaw = props.disabledStandardFeatures?.trim() ?? ""

  if (disabledRaw !== "") {
    const requestedKeys =
      disabledRaw === "all"
        ? new Set(Object.keys(standardFeatureRoutePrefixes))
        : toFeatureKeySet(disabledRaw)

    for (const featureKey of Object.keys(standardFeatureRoutePrefixes)) {
      if (requestedKeys.has(featureKey)) {
        disabledKeys.push(featureKey)
      }
    }
  }

  return disabledKeys
}
