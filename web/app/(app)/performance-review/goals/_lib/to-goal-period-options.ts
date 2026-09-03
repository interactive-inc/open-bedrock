export type GoalPeriodOption = {
  value: string
  label: string
}

/** `2026-H1` を `2026-H1（2026年上期）` にする。想定外の形はそのまま返す。 */
function toLabel(value: string): string {
  const matched = /^(\d{4})-H([12])$/.exec(value)

  if (matched === null) {
    return value
  }

  const half = matched[2] === "1" ? "上期" : "下期"

  return `${value}（${matched[1]}年${half}）`
}

/**
 * 評価期間ラベルから目標の期間選択肢を作る。
 *
 * 期間は日付ではなく半期を表すラベルなので、日付として扱わない。
 * 上期・下期の区切りを画面側で計算すると評価サイクルと正本が二重化するため、
 * 選択肢は `GET /review-cycles/periods` が返した期間だけから作る。
 *
 * `selected` に一覧の絞り込みや既存の目標から引き継いだ値が来て、それが一覧に無くても
 * 選択肢から落とさない。黙って消えると、利用者が気づかないまま別の期間へ登録してしまうため。
 */
export function toGoalPeriodOptions(
  periods: string[],
  selected: string | null,
): GoalPeriodOption[] {
  const values = new Set<string>()

  for (const period of periods) {
    if (period !== "") {
      values.add(period)
    }
  }

  if (selected !== null && selected !== "") {
    values.add(selected)
  }

  // 値が YYYY-Hn 形式なので、辞書順が時系列順と一致する。
  const sorted = Array.from(values).sort()

  return sorted.map((value) => ({ value, label: toLabel(value) }))
}
