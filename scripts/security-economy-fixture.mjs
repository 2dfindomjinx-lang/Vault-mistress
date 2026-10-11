import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function createSecurityFixture() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table profiles(id uuid primary key,username text,display_name text,address_term text default 'sub',coins integer default 10000,principessa_money integer default 1000,pm_burned_total integer default 0,affection integer default 100,tribute_total integer default 0,total_devotion integer default 0,pet_score integer default 0,pet_unlocked_at timestamptz default now(),last_pet_tax_at timestamptz default now(),last_owner_likeness_at timestamptz default now(),owner_likeness integer default 100,timeout_until timestamptz,updated_at timestamptz,is_admin boolean default false,hide_from_leaderboard boolean default false);
    create table user_pet_tasks(id uuid default gen_random_uuid(),user_id uuid,task_id text,status text,reward_score integer,completed_at timestamptz,reviewed_at timestamptz,metadata jsonb default '{}',unique(user_id,task_id));
    create table coin_transactions(id uuid default gen_random_uuid(),user_id uuid,amount integer,balance_before integer,balance_after integer,reason text,metadata jsonb);
    create table money_transactions(id uuid default gen_random_uuid(),user_id uuid,amount integer,balance_before integer,balance_after integer,reason text,metadata jsonb);
    create table devotion_events(user_id uuid,amount integer,source text,source_key text,metadata jsonb,unique(user_id,source_key));
    create table paid_operation_receipts(user_id uuid references profiles(id),operation text constraint paid_operation_receipts_operation_check check(operation in ('money-shop','wheel')),request_id uuid,input jsonb,result jsonb,created_at timestamptz default now(),primary key(user_id,operation,request_id));
    alter table paid_operation_receipts enable row level security; revoke all on paid_operation_receipts from public,anon,authenticated;`);
  const schema = await readFile('supabase/schema.sql','utf8');
  const triggerStart = schema.indexOf('create or replace function public.apply_devotion_event_to_profile_total()');
  const triggerEnd = schema.indexOf('update public.profiles profile', triggerStart);
  if (triggerStart<0 || triggerEnd<0) throw Error('Devotion trigger missing');
  await db.exec(schema.slice(triggerStart, triggerEnd));
  const furnace = await readFile('supabase/tribute-furnace.sql','utf8');
  const furnaceStart = furnace.indexOf('create or replace function public.burn_tribute_money(');
  await db.exec(furnace.slice(furnaceStart,furnace.indexOf('-- burned,',furnaceStart)).replace(/--[^\n]*$/, ''));
  for (const file of ['202610110001_pet_authority.sql','202610110002_wallet_shrine.sql']) {
    const sql = await readFile('supabase/'+file,'utf8');
    await db.exec(sql); await db.exec(sql);
  }
  return db;
}
