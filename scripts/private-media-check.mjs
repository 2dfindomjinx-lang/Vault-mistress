import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { privateMediaManifest, verifyPrivateMedia } from './private-media-storage.mjs';
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; grant usage on schema storage to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id text primary key,bucket_id text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated,service_role;
    create policy "preexisting broad policy" on storage.objects for all using(true) with check(true);`);
  const migration=await readFile('supabase/202610060002_private_media.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  await db.exec(`insert into storage.objects values('private','vault-private-media'),('other','existing-bucket');`);
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    assert.deepEqual((await db.query('select id from storage.objects')).rows,[{id:'other'}]);
    await assert.rejects(db.query("insert into storage.objects values('attack','vault-private-media')"),/row-level security/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');assert.equal((await db.query('select * from storage.objects')).rows.length,2);
  await db.exec('reset role');assert.equal((await db.query('select public from storage.buckets')).rows[0].public,false);
} finally { await db.close(); }
const entries=await privateMediaManifest(process.cwd());
assert.ok(Object.keys(entries).length>0);
assert.ok(Object.entries(entries).every(([name,entry])=>/^(gallery|worship)\//.test(name)&&/^[a-f0-9]{64}$/.test(entry.sha256)));
const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
try { await assert.rejects(verifyPrivateMedia(entries),/requires NEXT_PUBLIC_SUPABASE_URL/); }
finally { if(previous!==undefined)process.env.SUPABASE_SERVICE_ROLE_KEY=previous; }
console.log(`Private media: ${Object.keys(entries).length} content-addressed originals; private bucket, restrictive RLS despite broad existing policies, server access, reapply and missing-credentials guard passed. No live upload.`);
