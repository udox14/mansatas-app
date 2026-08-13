import { isReviewerReadSql, maskReviewerRecord, PLAY_REVIEWER_WRITE_ERROR } from './play-reviewer'

const RAW_STATEMENT = Symbol('reviewerRawStatement')
const STATEMENT_SQL = Symbol('reviewerStatementSql')

function readonlyError(): Error {
  return new Error(PLAY_REVIEWER_WRITE_ERROR)
}

function wrapReviewerStatement(statement: D1PreparedStatement, sql: string): D1PreparedStatement {
  return new Proxy(statement as any, {
    get(target, prop) {
      if (prop === RAW_STATEMENT) return target
      if (prop === STATEMENT_SQL) return sql
      if (prop === 'bind') return (...values: unknown[]) => wrapReviewerStatement(target.bind(...values), sql)
      if (prop === 'first') return async (...args: unknown[]) => {
        if (!isReviewerReadSql(sql)) throw readonlyError()
        return maskReviewerRecord(await target.first(...args), sql)
      }
      if (prop === 'all') return async (...args: unknown[]) => {
        if (!isReviewerReadSql(sql)) throw readonlyError()
        const result = await target.all(...args)
        return { ...result, results: (result.results || []).map((row: unknown) => maskReviewerRecord(row, sql)) }
      }
      if (prop === 'run') return async (...args: unknown[]) => {
        if (!isReviewerReadSql(sql)) throw readonlyError()
        return target.run(...args)
      }
      if (prop === 'raw') return async () => { throw new Error('Query raw tidak tersedia untuk akun Google Play Reviewer.') }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as D1PreparedStatement
}

export function wrapReviewerDatabase(db: D1Database): D1Database {
  return new Proxy(db as any, {
    get(target, prop) {
      if (prop === 'prepare') return (sql: string) => wrapReviewerStatement(target.prepare(sql), sql)
      if (prop === 'batch') return async (statements: any[]) => {
        const sqlList = statements.map(statement => String(statement[STATEMENT_SQL] || ''))
        if (sqlList.some(sql => !isReviewerReadSql(sql))) throw readonlyError()
        const results = await target.batch(statements.map(statement => statement[RAW_STATEMENT] || statement))
        return results.map((result: any, index: number) => ({
          ...result,
          results: Array.isArray(result.results)
            ? result.results.map((row: unknown) => maskReviewerRecord(row, sqlList[index]))
            : result.results,
        }))
      }
      if (prop === 'exec' || prop === 'dump') return async () => { throw readonlyError() }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as D1Database
}
