-- Grant the "ponyplay batch" (29 items added late on 2026-07-23: discipline
-- toys, blacked/garter/sport sets, and the angel/bimbo/grunge/ponyplay/
-- succubus Full Set items) to @vmprincipessa.
-- Run once in the Supabase SQL editor.

-- 1. Ensure crate_items rows exist (FK target for user_crate_inventory.item_id).
insert into public.crate_items (
  item_id, name, description, image_url, rarity, collection, sell_value, enabled
)
values
  ('latex_whip', 'Latex Whip', 'A glossy latex whip. Every crack is a warning.', '/crate-items/latex_whip.webp', 'common', 'latex', 500, true),
  ('cat_o_nine_tails', 'Cat-o''-Nine-Tails', 'Nine braided tails. Purr through it.', '/crate-items/cat_o_nine_tails.webp', 'rare', 'cat', 3050, true),
  ('pink_paddle', 'Pink Paddle', 'A cute pink paddle. Sting comes in pastel too.', '/crate-items/pink_paddle.webp', 'common', 'pink', 450, true),
  ('pink_feather_tickler', 'Pink Feather Tickler', 'A soft pink feather tickler. Sensation, not punishment.', '/crate-items/pink_feather_tickler.webp', 'rare', 'pink', 2750, true),
  ('ruler', 'Ruler', 'A strict wooden ruler. Class is in session.', '/crate-items/ruler.webp', 'rare', 'office', 2800, true),
  ('spiked_collar', 'Spiked Collar', 'A glossy black collar ringed with metal spikes.', '/crate-items/spiked_collar.webp', 'epic', 'latex', 7250, true),
  ('sharp_eyes', 'Sharp Eyes', 'Sharp winged eyeliner. A look that cuts.', '/crate-items/sharp_eyes.webp', 'common', 'makeup', 300, true),
  ('blacked_panties', 'Blacked Panties', 'Branded black panties. A statement, not a secret.', '/crate-items/blacked_panties.webp', 'legendary', 'blacked', 22000, true),
  ('blacked_bra', 'Blacked Bra', 'A branded black bra to match.', '/crate-items/blacked_bra.webp', 'legendary', 'blacked', 23000, true),
  ('blacked_leggings', 'Blacked Leggings', 'Branded black leggings, waist to ankle.', '/crate-items/blacked_leggings.webp', 'epic', 'blacked', 7750, true),
  ('bimbo_collar', 'Bimbo Collar', 'A glossy black collar that spells it out.', '/crate-items/bimbo_collar.webp', 'epic', 'bimbo', 10500, true),
  ('qos_tattoo', 'QOS Tattoo', 'A small inked spade. Everyone knows what it means.', '/crate-items/qos_tattoo.webp', 'uncommon', 'bimbo', 1350, true),
  ('slingshot_swimsuit', 'Slingshot Swimsuit', 'A minimal slingshot one-piece. Barely a swimsuit.', '/crate-items/slingshot_swimsuit.webp', 'legendary', 'swim', 21000, true),
  ('white_fingerless_sports_gloves', 'White Fingerless Sports Gloves', 'Fingerless athletic gloves for grip and show.', '/crate-items/white_fingerless_sports_gloves.webp', 'uncommon', 'sport', 1500, true),
  ('white_sneakers', 'White Sneakers', 'Clean white athletic sneakers.', '/crate-items/white_sneakers.webp', 'common', 'sport', 300, true),
  ('white_sports_bra', 'White Sports Bra', 'A supportive white sports bra.', '/crate-items/white_sports_bra.webp', 'rare', 'sport', 2850, true),
  ('white_sport_pants', 'White Sport Pants', 'Sleek white athletic leggings.', '/crate-items/white_sport_pants.webp', 'rare', 'sport', 2900, true),
  ('pink_yoga_pants', 'Pink Yoga Pants', 'Soft pink high-waisted yoga pants.', '/crate-items/pink_yoga_pants.webp', 'epic', 'pink', 7500, true),
  ('ripped_jeans', 'Ripped Jeans', 'Distressed skinny jeans, torn at the knees.', '/crate-items/ripped_jeans.webp', 'common', 'grunge', 300, true),
  ('latex_leggings', 'Latex Leggings', 'Skin-tight glossy latex, waist to ankle.', '/crate-items/latex_leggings.webp', 'rare', 'latex', 3100, true),
  ('black_garter_stockings', 'Black Garter Stockings', 'Sheer black stockings with an attached garter belt.', '/crate-items/black_garter_stockings.webp', 'uncommon', 'garter', 2250, true),
  ('pink_garter_stockings', 'Pink Garter Stockings', 'Sheer pink stockings with an attached garter belt.', '/crate-items/pink_garter_stockings.webp', 'rare', 'garter', 4500, true),
  ('red_garter_stockings', 'Red Garter Stockings', 'Sheer red stockings with an attached garter belt.', '/crate-items/red_garter_stockings.webp', 'rare', 'garter', 4550, true),
  ('white_garter_stockings', 'White Garter Stockings', 'Sheer white stockings with an attached garter belt.', '/crate-items/white_garter_stockings.webp', 'epic', 'garter', 10000, true),
  ('angel', 'Angel', 'A fully rendered angel set.', '/crate-items/angel.webp', 'epic', 'angel', 10000, true),
  ('bimbo_set', 'Bimbo Set', 'A fully rendered bimbo set.', '/crate-items/bimbo_set.webp', 'epic', 'bimbo', 15000, true),
  ('grunge_girl', 'Grunge Girl', 'A fully rendered grunge set.', '/crate-items/grunge_girl.webp', 'epic', 'grunge', 10000, true),
  ('ponyplay', 'Ponyplay', 'A fully rendered ponyplay set.', '/crate-items/ponyplay.webp', 'legendary', 'ponyplay', 27000, true),
  ('succubus', 'Succubus', 'A fully rendered succubus set.', '/crate-items/succubus.webp', 'epic', 'succubus', 16000, true)
on conflict (item_id) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  rarity = excluded.rarity,
  collection = excluded.collection,
  sell_value = excluded.sell_value,
  enabled = true;

-- 2. Grant 1 of each item to @vmprincipessa's inventory (matches by username or twitter_handle).
insert into public.user_crate_inventory (user_id, item_id, variant, quantity)
select p.id, v.item_id, 'normal', 1
from public.profiles p
cross join (
  values
    ('latex_whip'),
    ('cat_o_nine_tails'),
    ('pink_paddle'),
    ('pink_feather_tickler'),
    ('ruler'),
    ('spiked_collar'),
    ('sharp_eyes'),
    ('blacked_panties'),
    ('blacked_bra'),
    ('blacked_leggings'),
    ('bimbo_collar'),
    ('qos_tattoo'),
    ('slingshot_swimsuit'),
    ('white_fingerless_sports_gloves'),
    ('white_sneakers'),
    ('white_sports_bra'),
    ('white_sport_pants'),
    ('pink_yoga_pants'),
    ('ripped_jeans'),
    ('latex_leggings'),
    ('black_garter_stockings'),
    ('pink_garter_stockings'),
    ('red_garter_stockings'),
    ('white_garter_stockings'),
    ('angel'),
    ('bimbo_set'),
    ('grunge_girl'),
    ('ponyplay'),
    ('succubus')
) as v(item_id)
where p.username = 'vmprincipessa' or p.twitter_handle = 'vmprincipessa'
on conflict (user_id, item_id, variant) do update
  set quantity = public.user_crate_inventory.quantity + 1;
