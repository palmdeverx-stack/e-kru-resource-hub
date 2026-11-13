import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as z from 'zod';

function load(path, mocks) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
 { exports, require: name => { assert.ok(mocks[name],name); return mocks[name]; } });
 return exports;
}
const schema = load('src/sections/marketplace/shared/seller-category-schema.ts', {zod:z});
function fixture({ user = 'seller', csrf = false, rate = true, dbError = null } = {}) {
 const calls=[];
 const api=load('src/app/api/marketplace/seller/categories/route.ts', {
 'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
 'src/lib/auth-token':{requireAuthenticated:()=>user?{sub:user}:null},
 'src/lib/auth-rate-limit':{isActionAllowed:async()=>rate},
 'src/lib/request-security':{rejectCrossSiteMutation:()=>csrf?{status:403}:null},
 'src/sections/marketplace/shared/seller-category-schema':schema,
 'src/lib/supabase-admin':{supabaseAdmin:{rpc:async(name,args)=>{calls.push({name,args});return {data:{category:{name:args.p_name},reused:false},error:dbError};}}},
 });
 return {calls, post:(body)=>api.POST({json:async()=>body})};
}
test('normalizes category name and derives owner from session, never from client',async()=>{
 const f=fixture();const r=await f.post({name:'  My   Category ',userId:'other'});
 assert.equal(r.status,200); assert.equal(r.body.category.name,'My Category');
 assert.equal(f.calls[0].args.p_user_id,'seller');
});
for(const name of ['', 'a', 'a'.repeat(81), null, 123]) {
 test(`reject invalid category ${String(name).slice(0,12)}`,async()=>{const f=fixture();assert.equal((await f.post({name})).status,400);assert.equal(f.calls.length,0);});
}
for(const [options,status] of [[{user:null},401],[{csrf:true},403],[{rate:false},429],[{dbError:{code:'42501',message:'inactive seller'}},403],[{dbError:{code:'23514',message:'quota'}},409],[{dbError:{code:'PGRST202',message:'missing function'}},500]]) {
 test(`category access/error handling ${JSON.stringify(options)}`,async()=>{const f=fixture(options);assert.equal((await f.post({name:'Category'})).status,status);});
}
