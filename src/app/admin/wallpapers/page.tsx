"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Device = {
  id: string;
  activation_code: string;
  owner_name: string | null;
  bound_device_label: string | null;
  last_validated_at: string | null;
};

type Assignment = {
  id: string;
  activation_id: string | null;
  scope: "global" | "device";
  wallpaper_url: string;
  version: string;
  created_at: string;
};

type AdminState = {
  devices?: Device[];
  assignments?: Assignment[];
  error?: string;
};

type PreparedUpload = {
  uploadUrl: string;
  objectKey: string;
  wallpaperUrl: string;
  version: string;
  error?: string;
};

export default function WallpaperAdminPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [target, setTarget] = useState("global");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(true);

  const assignmentByDevice = useMemo(
    () => new Map(assignments.filter((item) => item.activation_id).map((item) => [item.activation_id, item])),
    [assignments],
  );
  const globalAssignment = assignments.find((item) => item.scope === "global") ?? null;

  const applyState = (result: AdminState) => {
    setDevices(result.devices ?? []);
    setAssignments(result.assignments ?? []);
  };

  const load = async () => {
    setIsBusy(true);
    try {
      const response = await fetch("/api/admin/wallpapers", { cache: "no-store" });
      const result = (await response.json()) as AdminState;
      if (!response.ok) throw new Error(result.error ?? "Wallpaper admin state failed.");
      applyState(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallpaper admin state failed.");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const uploadAndAssign = async () => {
    if (!file) {
      setStatus("Choose a wallpaper image first.");
      return;
    }

    setIsBusy(true);
    setStatus("Preparing secure R2 upload...");
    try {
      const prepareResponse = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare-upload", contentType: file.type }),
      });
      const prepared = (await prepareResponse.json()) as PreparedUpload;
      if (!prepareResponse.ok) throw new Error(prepared.error ?? "R2 upload preparation failed.");

      setStatus("Uploading wallpaper directly to R2...");
      const uploadResponse = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(
          `R2 upload returned HTTP ${uploadResponse.status}. Check the bucket CORS rule for the Vault domain.`,
        );
      }

      setStatus("Saving wallpaper assignment...");
      const assignResponse = await fetch("/api/admin/wallpapers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          activationId: target === "global" ? null : target,
          objectKey: prepared.objectKey,
          wallpaperUrl: prepared.wallpaperUrl,
          version: prepared.version,
        }),
      });
      const assigned = (await assignResponse.json()) as AdminState;
      if (!assignResponse.ok) throw new Error(assigned.error ?? "Wallpaper assignment failed.");

      applyState(assigned);
      setFile(null);
      const input = document.getElementById("wallpaper-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setStatus(target === "global" ? "Wallpaper assigned to everyone." : "Wallpaper assigned to the selected device.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wallpaper upload failed.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06030a] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl rounded-[2rem] border border-fuchsia-200/15 bg-black/55 p-5 shadow-[0_0_44px_rgba(217,70,239,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-200/70">Wallpaper Control</p>
            <h1 className="text-3xl font-black">Manual assignments</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Upload once to R2, then assign the image to every activated device or one specific device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200" href="/admin/app-licenses">
              Activation codes
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200" href="/admin">
              Back to admin
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-pink-200/20 bg-[#050208] p-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-zinc-300">
            Target
            <select
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
              disabled={isBusy}
              onChange={(event) => setTarget(event.target.value)}
              value={target}
            >
              <option value="global">Everyone (global)</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.owner_name || device.activation_code} — {device.bound_device_label || "Unknown device"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Wallpaper image
            <input
              accept="image/jpeg,image/png,image/webp"
              className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white"
              disabled={isBusy}
              id="wallpaper-file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <button
            className="rounded-2xl border border-emerald-200/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-50 md:col-span-2"
            disabled={isBusy || !file}
            onClick={() => void uploadAndAssign()}
            type="button"
          >
            Upload and apply wallpaper
          </button>
        </div>

        {status && (
          <p className="mt-4 rounded-2xl border border-pink-200/15 bg-white/[0.04] px-4 py-3 text-sm text-pink-50">
            {status}
          </p>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <AssignmentCard label="Everyone" assignment={globalAssignment} />
          {devices.map((device) => (
            <AssignmentCard
              assignment={assignmentByDevice.get(device.id) ?? null}
              key={device.id}
              label={`${device.owner_name || device.activation_code} · ${device.bound_device_label || "Unknown device"}`}
              subtitle={
                device.last_validated_at
                  ? `Last seen ${new Date(device.last_validated_at).toLocaleString()}`
                  : "Not synced yet"
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function AssignmentCard({
  assignment,
  label,
  subtitle,
}: {
  assignment: Assignment | null;
  label: string;
  subtitle?: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/35">
      {assignment ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-48 w-full object-cover" src={assignment.wallpaper_url} />
      ) : (
        <div className="flex h-48 items-center justify-center bg-white/[0.03] text-sm text-zinc-600">No direct assignment</div>
      )}
      <div className="p-4">
        <p className="font-black text-white">{label}</p>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
        <p className="mt-2 text-xs text-zinc-400">
          {assignment ? `Assigned ${new Date(assignment.created_at).toLocaleString()}` : "Uses the global wallpaper when available."}
        </p>
      </div>
    </article>
  );
}
