/**
 * MCP コネクタの callback として許可する redirect_uri かを判定する (#2417)。
 *
 * 同意画面はここを最初に通し、false なら同意 UI 自体を描画しない。この検証を怠ると、攻撃者が
 * 用意した redirect_uri へ grant がそのまま渡り、ユーザーが「接続を許可」を押しただけで任意の
 * サイトが本人のセッションを取得できる。
 *
 * 本番は製品configurationに登録された MCP callback だけを完全一致で許可する。ローカル開発の
 * MCP クライアントは起動ごとに待ち受けポートが変わるため、configurationが明示したhostnameに
 * 限りhttpの任意ポートを許可する。
 * ホスト名は「localhost で終わる」ではなく完全一致で見る (evil-localhost のような接尾辞一致を弾く)。
 * パスは /callback 完全一致に固定し、query / fragment 付きは許可しない。
 */
export type McpRedirectUriConfiguration = Readonly<{
  productionRedirectUris: ReadonlyArray<string>
  localHostnames: ReadonlyArray<string>
  callbackPath: string
}>

export function isAllowedMcpRedirectUri(
  value: string,
  configuration: McpRedirectUriConfiguration,
): boolean {
  if (configuration.productionRedirectUris.includes(value)) return true

  const parsed = parseUrl(value)

  if (parsed === null) return false

  if (parsed.protocol !== "http:") return false

  if (!configuration.localHostnames.includes(parsed.hostname)) return false

  if (parsed.pathname !== configuration.callbackPath) return false

  // 認可コードの持ち去り先を増やさないため、余分な query / fragment は許可しない。
  if (parsed.search !== "" || parsed.hash !== "") return false

  return true
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}
