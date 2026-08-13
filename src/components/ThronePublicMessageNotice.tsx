/**
 * The single most common reason a paid tribute lands in the unmatched queue.
 *
 * Throne's payment screen has a "Show Message Publicly" switch next to the gift
 * message. With it off, the message is delivered to the creator but is NOT
 * included in the webhook payload - a real gift_purchased event we received
 * carried price, currency, item_name and gifter_username and no message field
 * at all, even though the buyer had typed a code.
 *
 * Nothing on our side can recover that: no message means no code, no code means
 * no account to credit. So the only fix is telling people before they pay.
 */
export function ThronePublicMessageNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-100/85 ${className}`}
    >
      <span className="font-black uppercase tracking-[0.12em]">Important</span> — turn{" "}
      <span className="font-black">&ldquo;Show Message Publicly&rdquo;</span> on in Throne&rsquo;s payment
      screen. If it stays off, your message never reaches us and your code cannot be credited.
    </p>
  );
}
