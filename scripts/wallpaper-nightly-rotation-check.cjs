const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

const appKey = "principessa-wallpaper-control";
const image = (name) => ({ key: `wallpapers/${name}.webp`, url: `https://private.example/${name}.webp` });

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.app_activation_codes (
        id uuid primary key default gen_random_uuid(),
        app_key text not null,
        owner_name text,
        status text not null default 'active',
        bound_installation_id text
      );
    `);
    await db.exec(readFileSync("supabase/wallpaper-control-manual-assignments.sql", "utf8"));
    await db.exec(readFileSync("supabase/202609170001_wallpaper_nightly_rotation.sql", "utf8"));

    async function assign(asset, scope, at) {
      const id = crypto.randomUUID();
      await db.query(`
        insert into public.wallpaper_assignments
          (id, app_key, scope, activation_id, object_key, wallpaper_url, version, active, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, false, $8)
      `, [id, appKey, scope === "global" ? "global" : "device", scope === "global" ? null : scope,
        asset.key, asset.url, crypto.randomUUID(), at]);
      return id;
    }
    async function rotate(at) {
      const result = await db.query("select public.rotate_wallpaper_if_no_manual_assignment($1) as result", [at]);
      return result.rows[0].result;
    }

    const first = image("older");
    const second = image("newer");
    const deviceId = crypto.randomUUID();
    await db.query("insert into public.app_activation_codes (id, app_key, bound_installation_id) values ($1, $2, 'bound')", [deviceId, appKey]);
    await assign(first, "global", "2026-09-01T12:00:00Z");
    await assign(second, "global", "2026-09-10T12:00:00Z");
    const deviceAssignmentId = await assign(second, deviceId, "2026-09-18T17:00:00Z");
    await db.query("update public.wallpaper_assignments set active = true where object_key = $1 and scope = 'global'", [first.key]);
    await db.query("update public.wallpaper_assignments set active = true where id = $1", [deviceAssignmentId]);

    assert.equal((await rotate("2026-09-17T17:00:00Z")).status, "outside_night_window");
    const manualResult = await db.query(
      "select public.assign_wallpaper($1, null, $2, $3, $4, null) as id",
      [appKey, second.key, second.url, crypto.randomUUID()],
    );
    const manualId = manualResult.rows[0].id;
    await db.query("update public.wallpaper_assignments set created_at = $1 where id = $2", ["2026-09-17T03:00:00Z", manualId]);
    const manualSource = await db.query("select assignment_source from public.wallpaper_assignments where id = $1", [manualId]);
    assert.equal(manualSource.rows[0].assignment_source, "manual");
    // At 02:00 Türkiye time on the 18th, yesterday's 06:00 assignment is
    // still only 20 hours old and must block the rotation.
    assert.equal((await rotate("2026-09-17T23:00:00Z")).status, "skipped_manual");

    // A post-midnight manual assignment must also win that night's rotation.
    const midnightManual = await db.query(
      "select public.assign_wallpaper($1, null, $2, $3, $4, null) as id",
      [appKey, second.key, second.url, crypto.randomUUID()],
    );
    await db.query("update public.wallpaper_assignments set created_at = $1 where id = $2", ["2026-09-18T21:30:00Z", midnightManual.rows[0].id]);
    assert.equal((await rotate("2026-09-18T23:00:00Z")).status, "skipped_manual");

    // 25.5 hours later the manual assignment is outside the rolling window.
    assert.equal((await rotate("2026-09-19T23:00:00Z")).status, "assigned");
    assert.equal((await rotate("2026-09-19T23:30:00Z")).status, "already_rotated");

    const { rows } = await db.query(`
      select activation_id, object_key, assignment_source, scope
      from public.wallpaper_assignments
      where app_key = $1 and active
      order by scope
    `, [appKey]);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.scope === "global").object_key, first.key);
    assert.equal(rows.find((row) => row.scope === "global").assignment_source, "automatic");
    assert.equal(rows.find((row) => row.scope === "device").activation_id, deviceId);
    assert.equal(rows.find((row) => row.scope === "device").object_key, second.key);

    console.log("02:00 window, rolling 24-hour manual guard, daily rotation, and device override passed.");
  } finally {
    await db.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
