import { redirect } from "next/navigation";

// The in-site puzzle was replaced by paid external jigsaw links, which live in
// the Tasks panel. Redirecting (rather than rendering Home with initialPanel)
// also fixes a latent bug: getPanelForPath("/puzzle") returned "home", so
// Back-then-Forward on this URL used to flip it from Tasks to Home.
export default function PuzzlePage() {
  redirect("/tasks");
}
