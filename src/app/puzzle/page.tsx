// Puzzle now lives inside the Tasks panel (collapsible section) instead of
// its own tab. This route stays so old /puzzle bookmarks land somewhere
// sensible instead of 404ing.
import Home from "../page";

export default function PuzzlePage() {
  return <Home initialPanel="tasks" />;
}
