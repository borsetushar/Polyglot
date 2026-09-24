import { describe, expect, it } from 'vitest';

import db from './database.js';

describe('database', () => {
  it('creates the required tables', () => {
    const tables = db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `)
      .all() as Array<{ name: string }>;

    const names = tables.map((table) => table.name);

    expect(names).toContain('tenants');
    expect(names).toContain('conversations');
    expect(names).toContain('messages');
    expect(names).toContain('usage');
  });
});