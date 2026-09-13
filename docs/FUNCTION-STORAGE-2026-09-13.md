# Function storage cleanup

The September 12 build audit measured 683.82 MB summed dynamic-route traces.
The rebuilt implementation measures 431.31 MB, approximately 252.51 MB (36.9%) less.
These are uncompressed local dependency traces counting repeated files per route,
not Vercel billed storage. The baseline predates other recent application edits.

- OG/share traces now include only 220 crate images, rather than unrelated public media.
- Build-generated filename catalogs replace runtime shrine/worship directory enumeration.
- The worship image endpoint retains private files and its existing authorization.
- The overlay manifest is prerendered; file hashes, lengths and URLs are generated at build time.
- Wallpaper streaming no longer imports AWS/Firebase upload and push code.
- Admin chat read-state updates no longer import Firebase.
- Profile column selection is isolated from cosmetic and task catalogs in 31 API imports.
- Deleted 497 obsolete source/archive, backup and screenshot files (approximately 111 MB).
- Removed downloaded HTML from the unpushed commit; the downloader now parses HTML in memory.
- Kept approved sounds, preferences, audition pages, credits, and used private images.

Run `npm run build` then `node scripts/function-storage-check.mjs`.
Asset manifests regenerate during `npm run build` and `npm run dev`.
`node scripts/selected-sounds-check.cjs` verifies the approved sound assets still match the audition choices.

Private gallery/worship object-storage migration was not performed: those are active
protected assets, not disposable build output. Such a migration needs an uploaded,
verified private object set before replacing local reads. No retention policies,
Vercel regions, or storage-account settings were changed. Existing stored deployments
will not shrink merely because new deployment bundles are smaller.
