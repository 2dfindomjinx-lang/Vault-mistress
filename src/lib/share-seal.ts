// Client helper: mint a Court Seal and hand it to X's post composer.
//
// The window is opened BEFORE the network round trip - popup blockers only
// allow windows opened synchronously inside a user gesture, and the await
// would otherwise cost us that. On failure the blank tab is closed again and
// the error goes back to the caller's usual error surface.
export async function postSealToX(
  board: string,
  extra: Record<string, unknown> = {},
): Promise<string | null> {
  const popup = window.open("about:blank", "_blank");

  try {
    const response = await fetch("/api/user/court-seal", {
      body: JSON.stringify({ board, ...extra }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; shareText?: string; url?: string }
      | null;
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error ?? "The seal could not be minted.");
    }

    const sealUrl = new URL(payload.url, window.location.origin).toString();
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(payload.shareText ?? "")}&url=${encodeURIComponent(sealUrl)}`;
    if (popup) {
      popup.location.href = intent;
    } else {
      window.open(intent, "_blank", "noopener,noreferrer");
    }
    return null;
  } catch (error) {
    popup?.close();
    return error instanceof Error ? error.message : "The seal could not be minted.";
  }
}
