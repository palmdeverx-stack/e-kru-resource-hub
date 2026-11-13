// Isolated Postgres WASM verification. No production connection is used.
const { PGlite } = require(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table marketplace_grade_levels(id uuid primary key default gen_random_uuid(),code varchar(40) unique not null,name text not null,is_active boolean default true,sort_order int default 0);
 create table marketplace_curricula(like marketplace_grade_levels including all);
 create table marketplace_sellers(owner_id uuid,status text);
 create table marketplace_products(id uuid primary key default gen_random_uuid(),curriculum_id uuid references marketplace_curricula(id));
 create table marketplace_product_grade_levels(product_id uuid references marketplace_products(id),grade_level_id uuid references marketplace_grade_levels(id));
 insert into marketplace_sellers values('00000000-0000-0000-0000-000000000001','active');`);
 await db.exec(readFileSync('supabase/migrations/202611130003_marketplace_seller_grade_curriculum.sql','utf8'));
 const create = async (kind,name,group='other') => (await db.query('select marketplace_create_seller_lookup($1,$2,$3,$4) as result',['00000000-0000-0000-0000-000000000001',kind,name,group])).rows[0].result;
 for(const [kind,table] of [['grade-levels','marketplace_grade_levels'],['curricula','marketplace_curricula']]) {
   const first=await create(kind,' Test  Entry ','primary');
   assert.equal(first.item.name,'Test Entry');
   assert.equal((await create(kind,'test entry')).reused,true);
   if(kind==='grade-levels') assert.match(first.item.code,/^p-/);
   assert.ok(first.item.code.length<=40);
   if(kind==='grade-levels') {
     const product=(await db.query('insert into marketplace_products default values returning id')).rows[0];
     await db.query('insert into marketplace_product_grade_levels values($1,$2)',[product.id,first.item.id]);
     await db.exec('delete from marketplace_product_grade_levels');
   } else {
     await db.query('insert into marketplace_products(curriculum_id) values($1)',[first.item.id]);
     await db.exec('update marketplace_products set curriculum_id=null');
   }
   const used=(await db.query(`select * from ${table} where id=$1`,[first.item.id])).rows[0];
   assert.ok(used.first_used_at); assert.equal(used.expires_at,null);
   const unused=await create(kind,'Unused');
   await db.query(`update ${table} set expires_at=now()-interval '1 second' where id=$1`,[unused.item.id]);
   assert.equal((await db.query('select marketplace_cleanup_unused_lookups() as n')).rows[0].n,1);
   assert.equal((await db.query(`select count(*)::int as n from ${table} where id=$1`,[first.item.id])).rows[0].n,1);
   const active=await create(kind,'Not expired');
   assert.equal((await db.query('select marketplace_cleanup_unused_lookups() as n')).rows[0].n,0);
   await db.query(`update ${table} set is_active=false where id=$1`,[active.item.id]);
   await assert.rejects(create(kind,'Not expired'),/ปิดใช้งาน/);
   for(let i=0;i<28;i++)await create(kind,'Extra '+i);
   await assert.rejects(create(kind,'Over quota'),/30/);
 }
 await assert.rejects(create('invalid','Name'),/ประเภท/);
 await assert.rejects(create('grade-levels','Name','invalid'),/กลุ่ม/);
 await assert.rejects(db.query('select marketplace_create_seller_lookup($1,$2,$3,$4)',['00000000-0000-0000-0000-000000000002','curricula','Denied','other']),/เฉพาะร้านค้า/);
 console.log('PASS: grade/curriculum creation, reuse, group codes, first-use retention, expiration, inactive reuse, quota, invalid kinds/groups and ownership');
 await db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
