-- New Cosplay Case full-set catalog entries (2026-07).
-- Run once in the Supabase SQL editor before granting or dropping these items.

insert into public.crate_items (
  item_id,
  name,
  description,
  image_url,
  rarity,
  collection,
  sell_value,
  enabled
)
values
  ('asuka_cosplay', 'Asuka Cosplay', 'A fully rendered cosplay set.', '/crate-items/asuka_cosplay.png', 'legendary', 'cosplay', 45000, true),
  ('asuna_cosplay', 'Asuna Cosplay', 'A fully rendered cosplay set.', '/crate-items/asuna_cosplay.png', 'legendary', 'cosplay', 45000, true),
  ('frieren_cosplay', 'Frieren Cosplay', 'A fully rendered cosplay set.', '/crate-items/frieren_cosplay.png', 'legendary', 'cosplay', 47500, true),
  ('megumin_cosplay', 'Megumin Cosplay', 'A fully rendered cosplay set.', '/crate-items/megumin_cosplay.png', 'legendary', 'cosplay', 47500, true),
  ('misa_amane_cosplay', 'Misa Amane Cosplay', 'A fully rendered cosplay set.', '/crate-items/misa_amane_cosplay.png', 'legendary', 'cosplay', 45000, true),
  ('mona_cosplay', 'Mona Cosplay', 'A fully rendered cosplay set.', '/crate-items/mona_cosplay.png', 'legendary', 'cosplay', 47500, true),
  ('raiden_shogun_cosplay', 'Raiden Shogun Cosplay', 'A fully rendered cosplay set.', '/crate-items/raiden_shogun_cosplay.png', 'legendary', 'cosplay', 50000, true)
on conflict (item_id) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  rarity = excluded.rarity,
  collection = excluded.collection,
  sell_value = excluded.sell_value,
  enabled = true;
