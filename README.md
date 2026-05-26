# Vault Mistress

SFW Next.js prototype for a dark luxury anime companion and gallery unlock
experience. The app uses fake local coins, local React state, placeholder
images, and scripted messages. There is no backend, authentication, real
payment processing, or explicit content.

## File Structure

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    CharacterCard.tsx
    GalleryGrid.tsx
    MessageBox.tsx
    StatsPanel.tsx
    TaskList.tsx
    TributePanel.tsx
  lib/
    types.ts
public/
  defne-main.png
  gallery/
    defne-1.png
    defne-2.png
    defne-3.png
    defne-4.png
```

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the prototype.

## Prototype Notes

- Tribute and gallery unlocks spend fake in-app coins only.
- Affection, task progress, and unlocks live in local React state.
- Comments in the UI mark where a future backend or Supabase persistence layer
  could be added.
- Placeholder PNGs in `public/` are intentionally simple and SFW.
