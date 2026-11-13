// Run against an isolated Postgres WASM engine, never a production connection.
// PGLITE_MODULE_PATH=/path/to/node_modules/@electric-sql/pglite node tests/database/seller-category-lifecycle.cjs
const { PGlite } = require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table marketplace_categories(id uuid primary key default gen_random_uuid(), name text unique not null, description text, sort_order int default 0, is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now());
 create table marketplace_sellers(id uuid default gen_random_uuid(),owner_id uuid,status text);
 create table marketplace_products(id uuid default gen_random_uuid(),category text);
 insert into marketplace_sellers(owner_id,status) values('00000000-0000-0000-0000-000000000001','active');`);
 await db.exec(readFileSync('supabase/migrations/202611130002_marketplace_seller_categories.sql','utf8'));
 const create = async name => (await db.query('select marketplace_create_seller_category($1,$2) as result',['00000000-0000-0000-0000-000000000001', name])).rows[0].result;
 const first = await create('  Test   Category ');
 assert.equal(first.category.name,'Test Category');
 assert.equal((await create('test category')).reused,true);
 await db.exec(`insert into marketplace_products(category) values('Test Category'); delete from marketplace_products;`);
 let row=(await db.query('select * from marketplace_categories')).rows[0];
 assert.ok(row.first_used_at); assert.equal(row.expires_at,null);
 await db.exec(`update marketplace_categories set expires_at=now()-interval '1 hour';`);
 assert.equal((await db.query('select marketplace_cleanup_unused_categories() as n')).rows[0].n,0);
 await create('Unused');
 await db.exec(`update marketplace_categories set expires_at=now()-interval '1 second' where name='Unused';`);
 assert.equal((await db.query('select marketplace_cleanup_unused_categories() as n')).rows[0].n,1);
 await create('Not expired');
 assert.equal((await db.query('select marketplace_cleanup_unused_categories() as n')).rows[0].n,0);
 await db.exec(`insert into marketplace_categories(name) values('System');`);
 assert.equal((await db.query('select marketplace_cleanup_unused_categories() as n')).rows[0].n,0);
 await assert.rejects(db.query('select marketplace_create_seller_category($1,$2)',['00000000-0000-0000-0000-000000000002','Denied']), /เฉพาะร้านค้า/);
 await assert.rejects(create('x'),/2–80/);
 await db.exec(`update marketplace_categories set is_active=false where name='Not expired';`);
 await assert.rejects(create('Not expired'),/ปิดใช้งาน/);
 for(let i=0;i<28;i++)await create('Category '+i);
 await assert.rejects(create('Over quota'), /30/);
 console.log('PASS: migration SQL, normalized reuse, first-use retention, expired deletion, unexpired/system retention, ownership, length, inactive category, 30-category quota');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
