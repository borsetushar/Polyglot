import db from './database.js';

export interface Tenant {
  id: string;
  name: string;
}

export function createTenant(name: string): Tenant {
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO tenants (id, name)
    VALUES (?, ?)
  `).run(id, name);

  return {
    id,
    name,
  };
}

export function getTenant(id: string): Tenant | null {
  const tenant = db
    .prepare(`
      SELECT id, name
      FROM tenants
      WHERE id = ?
    `)
    .get(id) as Tenant | undefined;

  return tenant ?? null;
}

export function ensureTenant(
  id: string,
  name: string
): Tenant {
  const existing = getTenant(id);

  if (existing) {
    return existing;
  }

  db.prepare(`
    INSERT INTO tenants (id, name)
    VALUES (?, ?)
  `).run(id, name);

  return {
    id,
    name,
  };
}