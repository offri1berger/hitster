import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from './types.js'

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://backspin_maestro:backspin_maestro@localhost:5432/backspin_maestro',
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }),
  }),
})