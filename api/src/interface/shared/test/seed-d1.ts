// テスト用: snake_case の行オブジェクト配列を D1 のテーブルへ INSERT する。
export async function seedD1(
  db: D1Database,
  table: string,
  rows: ReadonlyArray<Record<string, string | number | boolean | null>>,
): Promise<void> {
  for (const row of rows) {
    const columns = Object.keys(row)

    if (columns.length === 0) {
      continue
    }

    const placeholders = columns.map(() => "?").join(", ")

    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`

    await db
      .prepare(sql)
      .bind(...columns.map((column) => row[column] ?? null))
      .run()
  }
}
