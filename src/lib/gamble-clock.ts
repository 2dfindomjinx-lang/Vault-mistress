// Exclude time spent authenticating, querying and building the response from
// the network estimate. All browser elapsed time uses the monotonic clock.
export function estimateGambleClock(
  sentAt: number,
  receivedAt: number,
  serverReceivedAt: number,
  serverSentAt: number,
) {
  const elapsed = Math.max(0, receivedAt - sentAt);
  const processing = Math.max(0, serverSentAt - serverReceivedAt);
  const transit = Math.max(0, elapsed - processing) / 2;
  return serverSentAt + transit;
}
