// A transport retry represents the same action, including when the first response is lost.
export async function postEconomyAction(url: string, body: unknown) {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  };
  try {
    return await fetch(url, init);
  } catch {
    return fetch(url, init);
  }
}
