// Same app shell as "/" - "cases" is the URL for the "crates" (gacha) panel.
// See src/app/tasks/page.tsx for why this passes its own initialPanel
// instead of just re-exporting the default.
import Home from "../page";

export default function CasesPage() {
  return <Home initialPanel="crates" />;
}
