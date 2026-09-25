import { warmMigratedSqliteTemplates } from "@tests/api/support/migrated-sqlite-database"

// 全 migration の適用は CI で 1 回 5 秒近くかかる。test の制限の外で一度だけ作り、各 test は複製を使う。
warmMigratedSqliteTemplates()
