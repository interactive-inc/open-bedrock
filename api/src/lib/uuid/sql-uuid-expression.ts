/**
 * migration の中で UUID を採番する SQLite 式 (Issue #1311)。
 *
 * SQLite に UUID 生成関数が無いため、`randomblob()` を 8-4-4-4-12 の形へ組み立てる。
 * version と variant を乱数任せにすると `uuidCheckPredicate` の GLOB を通らないので、
 * version は `4`、variant は `[89ab]` から選んで固定する。
 *
 * 既存行の backfill に使う値は v4 とする (Issue #1311 の判断 5)。v7 の時刻部を
 * `created_at` から合成することは純粋な SQL では現実的でなく、版を問わない検査に
 * したので v4 で足りる。新規採番だけが `createUuidV7()` を使う。
 */
export const SQL_UUID_V4_EXPRESSION =
  "lower(hex(randomblob(4))) || '-' || " +
  "lower(hex(randomblob(2))) || '-' || " +
  "'4' || substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || " +
  "lower(hex(randomblob(6)))"
