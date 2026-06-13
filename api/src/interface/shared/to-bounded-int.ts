// 一覧のページング既定値。各ルートで重複定義しないよう集約する。
export const DEFAULT_LIST_LIMIT = 50

export const MAX_LIST_LIMIT = 100

// SQLite/D1 の OFFSET は 32bit 符号付き整数が上限。Number.MAX_SAFE_INTEGER を渡すと
// ドライバでオーバーフローするため、現実的な上限に丸める。
export const MAX_LIST_OFFSET = 2_147_483_647

// 組織構造（部署ノード一覧・ツリー・部署メンバー）は全件をツリーやドロップダウンとして
// 一括描画するため limit/offset ページングに馴染まない。代わりにフルスキャンの暴走を防ぐ
// 安全上限を設ける。実在の組織でこの件数に達することは想定しないが、超えた場合はサーバ
// ログに記録したうえで切り詰め、サイレントな無制限読み取り／巨大レスポンスを防ぐ。
export const MAX_ORG_NODES = 1000

// クエリ文字列を [min, max] の整数に丸める。未指定・非整数・混在文字列・min 未満は fallback。
// limit は min:1（0 を空一覧でなく既定にフォールバック）、offset は min:0（0 を正当値として維持）。
// Number.parseInt は "50abc" を 50 と貪欲に解釈するため、Number() + isInteger で厳密に判定する。
export function toBoundedInt(props: {
  raw: string | undefined
  fallback: number
  min: number
  max: number
}): number {
  if (props.raw === undefined) {
    return props.fallback
  }

  const parsed = Number(props.raw)

  if (Number.isInteger(parsed) === false || parsed < props.min) {
    return props.fallback
  }

  return parsed > props.max ? props.max : parsed
}
