/**
 * RSC でのサーバー取得失敗を表示する統一コンポーネント。
 * 各ページで `<p className="text-sm text-destructive">...の取得に失敗しました</p>` を書き散らさないようまとめる。
 */
type Props = {
  message: string
}

export function FetchError(props: Props) {
  return <p className="text-sm text-destructive">{props.message}</p>
}
