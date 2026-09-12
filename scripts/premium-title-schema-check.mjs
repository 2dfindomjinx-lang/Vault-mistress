import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = name => fs.readFileSync(new URL("../supabase/"+name,import.meta.url),"utf8");
const migration=read("202609110005_premium_title_schema.sql");
const report=migration.slice(migration.indexOf("with required"));
const columns=[...migration.matchAll(/\('([a-z_]+)','([a-z_]+)'\)/g)].map(match=>[match[1],match[2]]);
for(const scenario of ["empty","legacy","partial"]) {
  const db=new PGlite();
  try {
    await db.exec("set timezone='UTC'; create role anon; create role authenticated; create role service_role bypassrls;");
    if(scenario!=="empty") {
      // Legacy fixture deliberately lacks duration_hours and column defaults.
      // Do not depend on the old, locally ignored setup files.
      await db.exec(`
        create table premium_title_pool (
          id uuid primary key default gen_random_uuid(), sort_order integer not null default 0,
          name text not null, description text not null, price integer not null default 50000,
          enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
        );
        create table premium_title_config (
          id boolean primary key default true check(id),current_name text not null,current_description text not null,
          current_price integer not null default 50000,current_expires_at timestamptz not null,
          current_pool_id uuid references premium_title_pool(id) on delete set null,
          next_name text,next_description text,next_price integer,next_starts_at timestamptz,updated_at timestamptz not null default now()
        );
        insert into premium_title_config(id,current_name,current_description,current_expires_at) values(true,'Old title','Old description',now());
        insert into premium_title_pool(name,description) values('Old queue','Old queue description');
      `);
      await db.exec("update premium_title_config set current_name='Existing offer',current_price=65000,current_expires_at='2027-01-01',next_name='Legacy override'; update premium_title_pool set name='Existing queue',price=70000,sort_order=5,enabled=false;");
      if(scenario==="partial") await db.exec("alter table premium_title_pool drop column description, drop column updated_at; alter table premium_title_config drop column current_pool_id;");
    }
    await db.exec(migration);
    assert.equal((await db.query("select count(*)::int n from premium_title_config")).rows[0].n,1);
    const pool=(await db.query("select * from premium_title_pool")).rows[0];
    assert.equal(pool.duration_hours,720);
    if(scenario!=="empty") {
      assert.equal(pool.name,"Existing queue");assert.equal(pool.price,70000);assert.equal(pool.enabled,false);assert.equal(pool.sort_order,5);
      const config=(await db.query("select * from premium_title_config")).rows[0];
      assert.equal(config.current_name,"Existing offer");assert.equal(config.current_price,65000);
      assert.equal(config.current_expires_at.toISOString(),"2027-01-01T00:00:00.000Z");assert.equal(config.next_name,"Legacy override");
    }
    await db.exec("update premium_title_pool set duration_hours=48");
    const before=(await db.query("select * from premium_title_pool")).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query("select * from premium_title_pool")).rows,before,"Reapply preserves queue and configured duration");
    await assert.rejects(db.exec("update premium_title_pool set duration_hours=0"),/check constraint/);
    await assert.rejects(db.exec("update premium_title_pool set duration_hours=8761"),/check constraint/);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from premium_title_pool"),/permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select * from premium_title_pool")).rows.length,1);
    await db.exec("reset role");
    const missing=(await db.query(report)).rows;
    assert.ok(missing.length>0);
    assert.ok(missing.every(row=>["profiles","user_titles","coin_transactions"].includes(row.table_name)));
    for(const table of ["profiles","user_titles","coin_transactions"]) {
      const names=columns.filter(([name])=>name===table).map(([,name])=>name);
      await db.exec(`create table ${table} (${names.map(name=>name+" text").join(",")})`);
    }
    assert.equal((await db.query(report)).rows.length,0,"Dependency report clears only after every shared column exists");
    console.log("Premium title schema passed: "+scenario+", preserved values, rerun, duration bounds, permissions and complete missing-column report.");
  } finally { await db.close(); }
}
