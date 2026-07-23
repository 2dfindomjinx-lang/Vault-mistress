-- Grant every item added in the 2026-07 crate/item expansion to @vmprincipessa.
-- Run once in the Supabase SQL editor.

-- 1. Ensure crate_items rows exist (FK target for user_crate_inventory.item_id).
insert into public.crate_items (
  item_id, name, description, image_url, rarity, collection, sell_value, enabled
)
values
  ('asuka_cosplay', 'Asuka Cosplay', 'A fully rendered cosplay set.', '/crate-items/asuka_cosplay.png', 'legendary', 'cosplay', 40000, true),
  ('asuna_cosplay', 'Asuna Cosplay', 'A fully rendered cosplay set.', '/crate-items/asuna_cosplay.png', 'legendary', 'cosplay', 35000, true),
  ('frieren_cosplay', 'Frieren Cosplay', 'A fully rendered cosplay set.', '/crate-items/frieren_cosplay.png', 'legendary', 'cosplay', 35000, true),
  ('megumin_cosplay', 'Megumin Cosplay', 'A fully rendered cosplay set.', '/crate-items/megumin_cosplay.png', 'legendary', 'cosplay', 35000, true),
  ('misa_amane_cosplay', 'Misa Amane Cosplay', 'A fully rendered cosplay set.', '/crate-items/misa_amane_cosplay.png', 'legendary', 'cosplay', 55000, true),
  ('mona_cosplay', 'Mona Cosplay', 'A fully rendered cosplay set.', '/crate-items/mona_cosplay.png', 'legendary', 'cosplay', 45000, true),
  ('raiden_shogun_cosplay', 'Raiden Shogun Cosplay', 'A fully rendered cosplay set.', '/crate-items/raiden_shogun_cosplay.png', 'legendary', 'cosplay', 50000, true),
  ('ruined_makeup', 'Ruined Makeup', 'Streaked mascara and tears. Proof you couldn''t hold it together.', '/crate-items/ruined_makeup.webp', 'common', 'makeup', 325, true),
  ('black_lips', 'Black Lips', 'Bold black lipstick. Striking and a little dangerous.', '/crate-items/black_lips.webp', 'uncommon', 'makeup', 1550, true),
  ('red_lips', 'Red Lips', 'Classic red lipstick. Impossible to ignore.', '/crate-items/red_lips.webp', 'common', 'makeup', 275, true),
  ('pink_lips', 'Pink Lips', 'Soft pink lipstick. Sweet and inviting.', '/crate-items/pink_lips.webp', 'common', 'pink', 300, true),
  ('cat_ears', 'Cat Ears', 'Perky cat ears. Purr on command.', '/crate-items/cat_ears.webp', 'uncommon', 'cat', 1300, true),
  ('cat_collar', 'Cat Collar', 'A collar with a little bell. Everyone hears you coming.', '/crate-items/cat_collar.webp', 'uncommon', 'cat', 1450, true),
  ('cat-bra', 'Cat Bra', 'A bra with a playful cat motif.', '/crate-items/cat-bra.webp', 'epic', 'cat', 9000, true),
  ('red_fishnet_croptop', 'Red Fishnet Croptop', 'Fishnet crop top with a fiery red trim.', '/crate-items/red_fishnet_croptop.webp', 'legendary', 'fishnet', 30000, true),
  ('cat_croptop', 'Cat Camisole', 'A slinky camisole with a playful cat motif.', '/crate-items/cat_croptop.webp', 'uncommon', 'cat', 1650, true),
  ('pink_camisole', 'Pink Camisole', 'A silky pink camisole. Delicate and revealing.', '/crate-items/pink_camisole.webp', 'uncommon', 'pink', 1700, true),
  ('classic_gloves', 'Classic Gloves', 'Simple fitted gloves. A basic finishing touch.', '/crate-items/classic_gloves.webp', 'common', 'classic', 250, true),
  ('latex_gloves', 'Latex Gloves', 'Glossy latex gloves that grip tight.', '/crate-items/latex_gloves.webp', 'rare', 'latex', 2850, true),
  ('pink_gloves', 'Pink Gloves', 'Soft pink gloves for delicate hands.', '/crate-items/pink_gloves.webp', 'uncommon', 'pink', 1500, true),
  ('cute_gloves', 'Cute Gloves', 'Soft pastel gloves with a delicate trim.', '/crate-items/cute_gloves.webp', 'uncommon', 'cute', 1600, true),
  ('cat_panties', 'Cat Panties', 'Playful panties with a cat print. Meow.', '/crate-items/cat_panties.webp', 'epic', 'cat', 7000, true),
  ('cat_short_shorts', 'Cat Short Shorts', 'Tiny shorts with a cat-print trim.', '/crate-items/cat_short_shorts.webp', 'rare', 'cat', 3100, true),
  ('fishnet_panties', 'Fishnet Panties', 'Open-weave fishnet panties. Barely there.', '/crate-items/fishnet_panties.webp', 'epic', 'fishnet', 8000, true),
  ('red_fishnet_shorts', 'Red Fishnet Shorts', 'Fishnet shorts with a bold red trim.', '/crate-items/red_fishnet_shorts.webp', 'legendary', 'fishnet', 20000, true),
  ('red_office_skirt', 'Red Office Skirt', 'A tight red pencil skirt. Dress code: obedience.', '/crate-items/red_office_skirt.webp', 'common', 'office', 350, true),
  ('cute_dress', 'Cute Dress', 'A soft, girly dress. Innocent on the outside.', '/crate-items/cute_dress.webp', 'rare', 'cute', 3000, true),
  ('cat_thighhighs', 'Cat Thighhighs', 'Thighhighs with a paw-print pattern.', '/crate-items/cat_thighhighs.webp', 'rare', 'cat', 2700, true),
  ('dominatrix_boots', 'Dominatrix Boots', 'Tall latex boots built for command.', '/crate-items/dominatrix_boots.webp', 'legendary', 'latex', 15000, true),
  ('cat_sneakers', 'Cat Sneakers', 'Sneakers with a cute cat design.', '/crate-items/cat_sneakers.webp', 'epic', 'cat', 6000, true),
  ('cute_short_shorts', 'Cute Short Shorts', 'Snug little shorts that leave nothing to guess.', '/crate-items/cute_short_shorts.webp', 'uncommon', 'cute', 600, true),
  ('cute_choker', 'Cute Choker', 'A delicate choker with a little charm. Sweet and simple.', '/crate-items/cute_choker.webp', 'common', 'cute', 250, true),
  ('cute_bra', 'Cute Bra', 'A soft pastel bra with delicate trim.', '/crate-items/cute_bra.webp', 'rare', 'cute', 1500, true),
  ('cute_sneakers', 'Cute Sneakers', 'Pastel sneakers with a playful bow.', '/crate-items/cute_sneakers.webp', 'uncommon', 'cute', 500, true),
  ('latex_panties', 'Latex Panties', 'Skin-tight latex panties. Shiny and unforgiving.', '/crate-items/latex_panties.webp', 'epic', 'latex', 3800, true),
  ('latex_bra', 'Latex Bra', 'A tight latex bra, glossy and severe.', '/crate-items/latex_bra.webp', 'epic', 'latex', 3800, true),
  ('pink_highheels', 'Pink High Heels', 'Bright pink heels. Loud and confident.', '/crate-items/pink_highheels.webp', 'epic', 'pink', 3200, true),
  ('pink_panties', 'Pink Panties', 'Simple pink panties. Soft and unassuming.', '/crate-items/pink_panties.webp', 'epic', 'pink', 3400, true),
  ('pink_thighhighs', 'Pink Thighhighs', 'Soft pink thighhighs to match the rest of the set.', '/crate-items/pink_thighhighs.webp', 'uncommon', 'pink', 650, true),
  ('fishnet_choker', 'Fishnet Choker', 'An open-weave fishnet choker. Barely there.', '/crate-items/fishnet_choker.webp', 'uncommon', 'fishnet', 500, true),
  ('latex_tape', 'Latex Tape', 'Glossy latex tape sealed tight over the mouth.', '/crate-items/latex_tape.webp', 'uncommon', 'latex', 1000, true)
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
    ('asuka_cosplay'),
    ('asuna_cosplay'),
    ('frieren_cosplay'),
    ('megumin_cosplay'),
    ('misa_amane_cosplay'),
    ('mona_cosplay'),
    ('raiden_shogun_cosplay'),
    ('ruined_makeup'),
    ('black_lips'),
    ('red_lips'),
    ('pink_lips'),
    ('cat_ears'),
    ('cat_collar'),
    ('cat-bra'),
    ('red_fishnet_croptop'),
    ('cat_croptop'),
    ('pink_camisole'),
    ('classic_gloves'),
    ('latex_gloves'),
    ('pink_gloves'),
    ('cute_gloves'),
    ('cat_panties'),
    ('cat_short_shorts'),
    ('fishnet_panties'),
    ('red_fishnet_shorts'),
    ('red_office_skirt'),
    ('cute_dress'),
    ('cat_thighhighs'),
    ('dominatrix_boots'),
    ('cat_sneakers'),
    ('cute_short_shorts'),
    ('cute_choker'),
    ('cute_bra'),
    ('cute_sneakers'),
    ('latex_panties'),
    ('latex_bra'),
    ('pink_highheels'),
    ('pink_panties'),
    ('pink_thighhighs'),
    ('fishnet_choker'),
    ('latex_tape')
) as v(item_id)
where p.username = 'vmprincipessa' or p.twitter_handle = 'vmprincipessa'
on conflict (user_id, item_id, variant) do update
  set quantity = public.user_crate_inventory.quantity + 1;
