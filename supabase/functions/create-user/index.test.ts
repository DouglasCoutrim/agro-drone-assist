import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function setup(limit = 2, count: number | null = 2, planError: unknown = null) {
  const createUser = mock(async () => ({ error: { message: 'test stop' } }));
  const client: any = {
    auth: { getUser: async () => ({ data: { user: { id: 'caller' } } }), admin: { createUser } },
    from(table: string) {
      const q: any = { select: () => q, eq: () => q,
        maybeSingle: async () => table === 'user_roles' ? { data: { role: 'admin' } }
          : table === 'profiles' ? { data: { organization_id: 'shop-a' } }
          : table === 'organizations' ? { data: { plan: 'trial' } }
          : { data: { max_users: limit }, error: planError },
        then: (resolve: any) => resolve({ count, error: null }),
      }; return q;
    },
  };
  let handler: any;
  const transpiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
  new Function('serve', 'createClient', 'corsHeaders', 'z', 'Deno', transpiled)(
    (fn: any) => { handler = fn; }, () => client, {}, z, { env: { get: () => 'test-config' } });
  const call = () => handler(new Request('https://example.test/create-user', { method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Test Person', email: 'test@example.test', senha: 'test-only-password', roles: ['consulta'] }),
  }));
  return { call, createUser };
}
describe('server-side member quota check', () => {
  it('refuses at the limit before creating an auth account', async () => {
    const s = setup(); expect((await s.call()).status).toBe(403);
    expect(s.createUser).not.toHaveBeenCalled();
  });
  it('fails closed if plan or count cannot be checked', async () => {
    for (const s of [setup(2, null), setup(2, 0, 'offline')]) {
      expect((await s.call()).status).toBe(503); expect(s.createUser).not.toHaveBeenCalled();
    }
  });
  it('allows account creation below the limit and for unlimited plans', async () => {
    for (const s of [setup(2, 1), setup(-1, 100)]) {
      await s.call(); expect(s.createUser).toHaveBeenCalledTimes(1);
    }
  });
});