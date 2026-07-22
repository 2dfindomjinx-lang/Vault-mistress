// Same app shell as "/" - see src/app/tasks/page.tsx for why this passes
// its own initialPanel instead of just re-exporting the default.
import Home from "../page";

export default function PetPage() {
  return <Home initialPanel="pet" />;
}
