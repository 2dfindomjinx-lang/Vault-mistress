import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildOverlayManifest } from "./overlay-media-manifest.mjs";

test("media catalog preserves legacy filtering and content-addressed updates", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "discipline-media-test-"));
  try {
    for (const name of ["image.jpg", "motion.GIF", "video.mp4", "clip.webm", "ignored.txt"])
      fs.writeFileSync(path.join(folder, name), "first");
    const legacy = buildOverlayManifest(folder);
    assert.deepEqual(legacy.images.map(item => item.fileName), ["image.jpg"]);
    assert.equal(legacy.images[0].mediaType, undefined);
    const manifest = buildOverlayManifest(folder, true);
    assert.equal(manifest.images.length, 4);
    assert.deepEqual(manifest.images.map(item => item.mediaType).sort(), ["gif", "image", "video", "video"]);
    const before = manifest.images.find(item => item.fileName === "video.mp4");
    fs.utimesSync(path.join(folder, "video.mp4"), new Date(), new Date());
    assert.equal(buildOverlayManifest(folder, true).images.find(item => item.fileName === "video.mp4").sha256, before.sha256);
    fs.writeFileSync(path.join(folder, "video.mp4"), "other");
    const after = buildOverlayManifest(folder, true).images.find(item => item.fileName === "video.mp4");
    assert.notEqual(after.sha256, before.sha256);
    assert.notEqual(after.imageUrl, before.imageUrl);
    const fd = fs.openSync(path.join(folder, "large.mp4"), "w");
    fs.ftruncateSync(fd, 25 * 1024 * 1024 + 1);
    fs.closeSync(fd);
    assert.throws(() => buildOverlayManifest(folder, true), /Invalid overlay size/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
