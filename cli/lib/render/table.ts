// 一覧の整形表示（依存なしの簡易版）。
// 列幅を内容に合わせ、ヘッダ + 罫線で整形する。日本語など全角は2幅で計算。
function width(value: string): number {
  let w = 0
  for (const ch of value) {
    // 全角・東アジア文字をざっくり2幅として扱う
    w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1
  }
  return w
}

function pad(value: string, target: number): string {
  return value + " ".repeat(Math.max(0, target - width(value)))
}

export function table(
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>,
  title?: string,
): string {
  const cells = rows.map((row) => row.map((cell) => String(cell ?? "")))
  const widths = columns.map((col, i) =>
    Math.max(width(col), ...cells.map((row) => width(row[i] ?? ""))),
  )

  const line = (chars: string[]) => chars.join("  ")
  const header = line(columns.map((col, i) => pad(col, widths[i] ?? 0)))
  const rule = line(widths.map((w) => "-".repeat(w)))
  const body = cells.map((row) => line(row.map((cell, i) => pad(cell, widths[i] ?? 0))))

  const out = [title, header, rule, ...body].filter((l): l is string => l !== undefined)
  return out.join("\n")
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
