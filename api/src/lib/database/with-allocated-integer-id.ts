const TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

const MAX_ATTEMPTS = 3

/**
 * 整数主キーの表へ、DB の暗黙の採番値（last_insert_rowid）に頼らず明示した ID で書き込む。
 *
 * 親行と子行を 1 つの D1 batch で書くとき、子行は親の ID を束縛値として受け取る。
 * 次の ID は SQLite の採番規則と同じく、AUTOINCREMENT の既発行値と現存する最大 ID の大きい方に 1 を足す。
 * 同時に同じ ID を読んだ書き込みは主キー衝突で batch ごと失敗するため、読み直して再試行する。
 * 主キーを UUID へ移すときは、この関数を乱数 ID の生成へ置き換えるだけで呼び出し側を変えない。
 */
export async function withAllocatedIntegerId<T>(
  database: D1Database,
  table: string,
  write: (id: number) => Promise<T>,
): Promise<T> {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new Error("table name is outside the allowed identifier shape")
  }

  for (let attempt = 1; ; attempt += 1) {
    const id = await readNextIntegerId(database, table)

    try {
      return await write(id)
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isPrimaryKeyConflict(error, table)) {
        throw error
      }
    }
  }
}

async function readNextIntegerId(database: D1Database, table: string): Promise<number> {
  const next = await database
    .prepare(
      `SELECT max(
         coalesce((SELECT seq FROM sqlite_sequence WHERE name = ?1), 0),
         coalesce((SELECT max(id) FROM ${table}), 0)
       ) + 1 AS next_id`,
    )
    .bind(table)
    .first<number>("next_id")

  if (typeof next !== "number" || !Number.isSafeInteger(next)) {
    throw new Error("failed to allocate integer id")
  }

  return next
}

function isPrimaryKeyConflict(error: unknown, table: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  if ("message" in error && typeof error.message === "string") {
    const conflict = new RegExp(`UNIQUE constraint failed: (?:\\S+, )*${table}\\.id(?![a-z0-9_])`)
    if (conflict.test(error.message)) {
      return true
    }
  }

  return "cause" in error && isPrimaryKeyConflict(error.cause, table)
}
