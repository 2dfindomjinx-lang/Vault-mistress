export type InventoryQuantity = { item_id: string; variant: string; quantity: number };

// Apply authoritative sale quantities, preserving item details and other variants.
export function applyInventoryQuantities<T extends InventoryQuantity>(items: T[], changes: InventoryQuantity[]) {
  const quantities = new Map(changes.map((item) => [JSON.stringify([item.item_id, item.variant]), item.quantity]));
  return items.flatMap((item) => {
    const quantity = quantities.get(JSON.stringify([item.item_id, item.variant]));
    if (quantity === undefined) return [item];
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
