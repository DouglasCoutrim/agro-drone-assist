import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Execute the actual Deno handler with isolated auth/database doubles.
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  .replace(/^import .*createClient.*;\r?\n/m, '');

afterEach(() => vi.restoreAllMocks());

function setup({ secret, user = null, authError = null, member = null, roleError = null }: {
  secret?: string; user?: { id: string } | null; authError?: unknown;
  member?: { user_id: string } | null; roleError?: unknown;
} = {}) {
  const tables: string[] = [];
  const getUser = vi.fn(async () => ({ data: { user }, error: authError }));
  const from = (table: string) => {
    tables.push(table);
    const query: any = {
      select: () => query, eq: () => query, in: () => query,
      lte: async () => ({ data: [] }), lt: async () => ({ data: [] }),
      maybeSingle: async () => ({ data: member, error: roleError }),
    };
    return query;
  };
  let handler!: (req: Request) => Promise<Response>;
  const deno = {
    env: { get: (name: string) => name === 'WEBHOOK_SECRET' ? secret : 'test-config' },
    serve: (fn: typeof handler) => { handler = fn; },
  };
  // Only the import is replaced; all authorization and business code stays intact.
  const transpiled = source.replace(/: any/g, '');
  new Function('Deno', 'createClient', transpiled)(deno, () => ({ from, auth: { getUser } }));
  const call = (headers: Record<string, string> = { authorization: 'Bearer test-token' }) =>
    handler(new Request('https://example.test/check', { method: 'POST', headers }));
  return { call, tables, getUser };
}

describe('tenant-blocking authorization', () => {
  it('rejects missing authentication before reading any table', async () => {
    const s = setup();
    expect((await s.call({})).status).toBe(401);
    expect(s.tables).toEqual([]);
  });
  it('rejects forged or expired tokens when the secret is unset', async () => {
    const s = setup({ authError: new Error('invalid token') });
    expect((await s.call()).status).toBe(401);
    expect(s.tables).toEqual([]);
  });
  it('rejects a regular account before reading tenants', async () => {
    const s = setup({ user: { id: 'ordinary-user' } });
    expect((await s.call()).status).toBe(403);
    expect(s.tables).toEqual(['platform_admins']);
  });
  it('fails closed when the role lookup fails', async () => {
    const s = setup({ user: { id: 'user' }, member: { user_id: 'user' }, roleError: new Error('offline') });
    expect((await s.call()).status).toBe(403);
    expect(s.tables).toEqual(['platform_admins']);
  });
  it('permits a verified platform administrator with no configured secret', async () => {
    const s = setup({ user: { id: 'platform-admin' }, member: { user_id: 'platform-admin' } });
    expect((await s.call()).status).toBe(200);
    expect(s.getUser).toHaveBeenCalledWith('test-token');
    expect(s.tables).toEqual(['platform_admins', 'tenant_invoices', 'organizations']);
  });
  it('rejects missing and incorrect configured secrets', async () => {
    const s = setup({ secret: 'test-scheduler-secret' });
    expect((await s.call()).status).toBe(401);
    expect((await s.call({ authorization: 'Bearer test-token', 'x-webhook-secret': 'wrong' })).status).toBe(401);
    expect(s.tables).toEqual([]);
  });
  it('preserves secret-authorized scheduled calls', async () => {
    const s = setup({ secret: 'test-scheduler-secret' });
    const response = await s.call({ authorization: 'Bearer test-token', 'x-webhook-secret': 'test-scheduler-secret' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, blocked: 0, checked: 0 });
    expect(s.getUser).not.toHaveBeenCalled();
  });
});