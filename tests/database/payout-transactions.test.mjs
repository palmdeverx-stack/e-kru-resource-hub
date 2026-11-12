// Isolated PostgreSQL only. Never point this fixture suite at a real database.
// PGHOST=/private/tmp PGPORT=55439 PGUSER=payout_test PGDATABASE=postgres \
// PAYOUT_TEST_ISOLATED=1 PSQL_BIN=/path/to/psql node --test tests/database/payout-transactions.test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const enabled = process.env.PAYOUT_TEST_ISOLATED === '1';
const sql = (source) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.env.PSQL_BIN || 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
      env: process.env,
    });
    let output = '',
      error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      error += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error.trim()))
    );
    child.stdin.end(source);
  });
const json = async (query) => JSON.parse(await sql(query));
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uid = () => randomUUID();

test('atomic seller payout and cumulative refund transactions', { skip: !enabled }, async (t) => {
  assert.ok(
    process.env.PGHOST?.startsWith('/private/tmp'),
    'require an isolated local Unix socket'
  );
  assert.equal(
    await sql("select count(*) from pg_tables where schemaname='public'"),
    '0',
    'fixture requires an empty database'
  );
  const base = readFileSync(
    new URL('../../supabase/marketplace_schema.sql', import.meta.url),
    'utf8'
  );
  const shipping = readFileSync(
    new URL('../../supabase/migrations/202608030001_marketplace_shipping.sql', import.meta.url),
    'utf8'
  );
  const table = (name) => {
    const source = base.includes(`create table if not exists public.${name} (`) ? base : shipping;
    const start = source.indexOf(`create table if not exists public.${name} (`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n);', start) + 4);
  };
  await sql(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create table public.marketplace_sellers(id uuid primary key, owner_id uuid);
    create table public.marketplace_payment_sessions(id uuid primary key,amount numeric(12,2),currency text,payment_method text,status text);
    create table public.marketplace_orders(id uuid primary key,seller_id uuid references public.marketplace_sellers(id),payment_session_id uuid references public.marketplace_payment_sessions(id));
    create table public.marketplace_finance_settings(id text primary key,minimum_payout numeric);
    insert into public.marketplace_finance_settings values('default',1);
    ${table('marketplace_payouts')}
    alter table public.marketplace_payouts add column account_number_snapshot_encrypted text;
    ${table('marketplace_ledger_entries')}
    create unique index marketplace_ledger_order_scope_type_key on public.marketplace_ledger_entries(order_id,account_scope,entry_type);
    create table public.marketplace_shipments(id uuid primary key,order_id uuid references public.marketplace_orders(id),shipping_fee numeric,refunded_amount numeric default 0,status text,reconciliation_status text,updated_at timestamptz);
    ${table('marketplace_shipping_ledger_entries')}
  `);
  await sql(
    readFileSync(
      new URL('../../supabase/migrations/202611120005_atomic_seller_payouts.sql', import.meta.url),
      'utf8'
    )
  );
  // The staged migration preserves the old application's conflict target.
  await sql(`insert into marketplace_sellers values('00000000-0000-4000-8000-000000000001',null);
    insert into marketplace_payment_sessions values('00000000-0000-4000-8000-000000000002',100,'THB','stripe','verified');
    insert into marketplace_orders values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
    insert into marketplace_ledger_entries(order_id,account_scope,entry_type,amount)
      values('00000000-0000-4000-8000-000000000003','platform','commission',0)
      on conflict(order_id,account_scope,entry_type) do nothing;`);
  await sql(
    readFileSync(
      new URL(
        '../../supabase/migrations/202611120006_enable_refund_ledger_deltas.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  async function seed(seller = uid()) {
    const session = uid(),
      order = uid();
    await sql(`insert into marketplace_sellers values(${lit(seller)},${lit(uid())}) on conflict do nothing;
      insert into marketplace_payment_sessions values(${lit(session)},100,'THB','stripe','verified');
      insert into marketplace_orders values(${lit(order)},${lit(seller)},${lit(session)});
      insert into marketplace_ledger_entries(order_id,seller_id,account_scope,entry_type,amount,available_at)
      values(${lit(order)},${lit(seller)},'seller','sale',90,now()-interval '1 day'),
            (${lit(order)},${lit(seller)},'platform','commission',10,now());`);
    return { seller, session, order, charge: 'ch_fixture_' + uid() };
  }
  const reserve = (f) =>
    json(
      `select create_marketplace_seller_payout(${lit(f.seller)},'004','Fixture bank','Fixture owner','fin-v1.fixture')`
    );
  const finish = (id, status, reference = 'REF-' + uid()) =>
    json(
      `select finish_marketplace_seller_payout(${lit(id)},${lit(status)},${lit(reference)},'fixture failure',${lit(uid())})`
    );
  const refund = (f, cents = 10000) =>
    json(
      `select reconcile_marketplace_stripe_refund(${lit(f.session)},${lit(f.charge)},10000,${cents})`
    );
  const rows = (query) => json(`select coalesce(json_agg(r),'[]') from (${query}) r`);

  await t.test('parallel reservations create exactly one funded payout', async () => {
    const f = await seed();
    const results = await Promise.allSettled([reserve(f), reserve(f)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      (await rows(`select * from marketplace_payouts where seller_id=${lit(f.seller)}`)).length,
      1
    );
  });
  await t.test('paid/failed race cannot leave paid funds withdrawable again', async () => {
    const f = await seed(),
      p = await reserve(f);
    await finish(p.id, 'processing');
    const results = await Promise.allSettled([finish(p.id, 'paid'), finish(p.id, 'failed')]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const [state] = await rows(`select status from marketplace_payouts where id=${lit(p.id)}`);
    const [ledger] = await rows(
      `select payout_id from marketplace_ledger_entries where account_scope='seller' and order_id=${lit(f.order)}`
    );
    assert.equal(ledger.payout_id, state.status === 'paid' ? p.id : null);
  });
  await t.test(
    'same successful result is idempotent, conflicting reference is rejected',
    async () => {
      const f = await seed(),
        p = await reserve(f);
      await finish(p.id, 'processing');
      await finish(p.id, 'paid', 'fixture-fixed-reference');
      assert.equal((await finish(p.id, 'paid', 'fixture-fixed-reference')).already_processed, true);
      await assert.rejects(finish(p.id, 'paid', 'other-reference'), /PAYOUT_ALREADY_PROCESSED/);
      const other = await seed(),
        p2 = await reserve(other);
      await finish(p2.id, 'processing');
      await assert.rejects(
        finish(p2.id, 'paid', 'FIXTURE-FIXED-REFERENCE'),
        /PAYOUT_DUPLICATE_REFERENCE/
      );
    }
  );
  await t.test('failed ledger reservation rolls back the newly inserted payout', async () => {
    const f = await seed();
    await sql(`create function public.fail_reserve() returns trigger language plpgsql as $$ begin if new.seller_id=${lit(f.seller)}::uuid and new.payout_id is not null then raise exception 'fixture reserve error'; end if; return new; end $$;
      create trigger fixture_fail_reserve before update on marketplace_ledger_entries for each row execute function fail_reserve();`);
    try {
      await assert.rejects(reserve(f), /fixture reserve error/);
      assert.equal(
        (await rows(`select * from marketplace_payouts where seller_id=${lit(f.seller)}`)).length,
        0
      );
    } finally {
      await sql(
        'drop trigger fixture_fail_reserve on marketplace_ledger_entries; drop function fail_reserve();'
      );
    }
  });
  await t.test('failed release rolls back failed status too', async () => {
    const f = await seed(),
      p = await reserve(f);
    await finish(p.id, 'processing');
    await sql(`create function public.fail_release() returns trigger language plpgsql as $$ begin if new.seller_id=${lit(f.seller)}::uuid and new.payout_id is null then raise exception 'fixture release error'; end if; return new; end $$;
      create trigger fixture_fail_release before update on marketplace_ledger_entries for each row execute function fail_release();`);
    try {
      await assert.rejects(finish(p.id, 'failed'), /fixture release error/);
      assert.equal(
        (await rows(`select status from marketplace_payouts where id=${lit(p.id)}`))[0].status,
        'processing'
      );
      assert.equal(
        (
          await rows(
            `select payout_id from marketplace_ledger_entries where order_id=${lit(f.order)} and account_scope='seller'`
          )
        )[0].payout_id,
        p.id
      );
    } finally {
      await sql(
        'drop trigger fixture_fail_release on marketplace_ledger_entries; drop function fail_release();'
      );
    }
  });
  await t.test(
    'partial, duplicate, stale and full refunds create immutable incremental debits',
    async () => {
      const f = await seed();
      assert.equal((await refund(f, 1000)).full_refund, false);
      assert.equal((await refund(f, 1000)).already_processed, true);
      assert.equal((await refund(f, 500)).already_processed, true);
      assert.equal((await refund(f)).full_refund, true);
      const debits = await rows(
        `select amount from marketplace_ledger_entries where order_id=${lit(f.order)} and account_scope='seller' and entry_type='refund' order by amount desc`
      );
      assert.deepEqual(
        debits.map((r) => Number(r.amount)),
        [-9, -81]
      );
      await assert.rejects(reserve(f), /PAYOUT_BELOW_MINIMUM/);
    }
  );
  await t.test(
    'refund invalidates unstarted payout and releases reservation atomically',
    async () => {
      const f = await seed(),
        p = await reserve(f);
      await refund(f);
      assert.equal(
        (await rows(`select status from marketplace_payouts where id=${lit(p.id)}`))[0].status,
        'cancelled'
      );
      await assert.rejects(finish(p.id, 'paid'), /PAYOUT_ALREADY_PROCESSED/);
      await assert.rejects(reserve(f), /PAYOUT_BELOW_MINIMUM/);
    }
  );
  await t.test(
    'refund after paid payout preserves paid history and offsets later earnings',
    async () => {
      const f = await seed(),
        p = await reserve(f);
      await finish(p.id, 'processing');
      await finish(p.id, 'paid');
      await refund(f);
      assert.equal(
        (await rows(`select amount,status from marketplace_payouts where id=${lit(p.id)}`))[0]
          .status,
        'paid'
      );
      const [debit] = await rows(
        `select amount,payout_id from marketplace_ledger_entries where order_id=${lit(f.order)} and account_scope='seller' and entry_type='refund'`
      );
      assert.equal(Number(debit.amount), -90);
      assert.equal(debit.payout_id, null);
      await seed(f.seller);
      await assert.rejects(reserve(f), /PAYOUT_BELOW_MINIMUM/);
      await seed(f.seller);
      assert.equal(Number((await reserve(f)).amount), 90);
    }
  );
  await t.test(
    'settled partial-refund debit remains immutable after an additional refund',
    async () => {
      const f = await seed();
      await refund(f, 1000);
      const p = await reserve(f);
      assert.equal(Number(p.amount), 81);
      await finish(p.id, 'processing');
      await finish(p.id, 'paid');
      await refund(f);
      const debits = await rows(
        `select amount,payout_id from marketplace_ledger_entries where order_id=${lit(f.order)} and account_scope='seller' and entry_type='refund' order by amount desc`
      );
      assert.equal(Number(debits[0].amount), -9);
      assert.equal(debits[0].payout_id, p.id);
      assert.equal(Number(debits[1].amount), -81);
      assert.equal(debits[1].payout_id, null);
    }
  );
  await t.test('shipping refunds follow cumulative ratio and do not duplicate', async () => {
    const f = await seed();
    const shipment = uid();
    await sql(
      `insert into marketplace_shipments(id,order_id,shipping_fee,status,reconciliation_status) values(${lit(shipment)},${lit(f.order)},20,'pending','pending')`
    );
    await refund(f, 2500);
    await refund(f, 2500);
    assert.equal(
      Number(
        (
          await rows(`select refunded_amount from marketplace_shipments where id=${lit(shipment)}`)
        )[0].refunded_amount
      ),
      5
    );
    await refund(f);
    const [state] = await rows(
      `select refunded_amount,status from marketplace_shipments where id=${lit(shipment)}`
    );
    assert.equal(Number(state.refunded_amount), 20);
    assert.equal(state.status, 'cancelled');
  });
  await t.test('refund racing a reservation leaves no payable pending payout', async () => {
    const f = await seed();
    const results = await Promise.allSettled([reserve(f), refund(f)]);
    assert.equal(results[1].status, 'fulfilled');
    const pending = await rows(`select * from marketplace_payouts where seller_id=${lit(f.seller)} and status in ('pending','processing')`);
    assert.equal(pending.length, 0);
    await assert.rejects(reserve(f), /PAYOUT_BELOW_MINIMUM/);
  });
  await t.test('anonymous callers cannot execute financial functions', async () => {
    const f = await seed();
    await assert.rejects(
      sql(
        `set role anon; select create_marketplace_seller_payout(${lit(f.seller)},'004','Bank','Owner','fin-v1.fixture')`
      ),
      /permission denied/
    );
  });
});
