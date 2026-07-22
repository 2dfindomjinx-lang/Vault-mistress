// Same app shell as "/" - renders with the matching initial panel so the
// very first (server-rendered) paint already shows the right content
// instead of a client-side flash. See src/app/page.tsx's Home component for
// how panel switching afterwards avoids remounting via history.pushState.
import Home from "../page";

export default function TasksPage() {
  return <Home initialPanel="tasks" />;
}
