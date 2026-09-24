/**
 * テスト用: 実時計を読みつつ、一度返した時刻より前へ戻らない時計を作る。
 * 端末の実時計は数 ms 巻き戻ることがあり、再認証grantの`last_used_at <= 現在時刻`のような
 * 時刻の前後関係を検査する経路が、前のrequestより前の時刻を受けて拒否される。
 * requestの`NOW`、access token、テストが書く時刻をこの時計へ揃え、前後関係を実時計の巻戻りから切り離す。
 */
export function createMonotonicTestClock(): () => Date {
  let latest = Number.NEGATIVE_INFINITY
  return () => {
    latest = Math.max(latest, Date.now())
    return new Date(latest)
  }
}
