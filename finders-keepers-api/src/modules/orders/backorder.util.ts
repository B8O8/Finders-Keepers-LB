/**
 * Inventory rules for backordering.
 *
 * Agreed behaviour: stock is floored at zero and never goes negative. The
 * shortfall on an order line is recorded as backorderQuantity instead, so
 * inventory never looks misleadingly positive and admins can see what is owed.
 *
 * Shared by CartService (availability) and OrdersService (checkout/cancel) so
 * there is exactly one implementation of these rules.
 */

/** What checkout may deduct, and what must be recorded as backordered. */
export function splitQuantity(stock: number, quantity: number) {
  const available = Math.max(0, stock);
  const deductable = Math.min(quantity, available);
  const backorderQuantity = quantity - deductable;

  return { deductable, backorderQuantity, isBackorder: backorderQuantity > 0 };
}

/**
 * What cancelling an order returns to stock. Backordered units were never
 * deducted, so restoring them would invent stock that never existed.
 */
export function restockQuantity(quantity: number, backorderQuantity: number) {
  return Math.max(0, quantity - backorderQuantity);
}

/** Whether a line may be added to the cart / checked out. */
export function isPurchasable(
  stock: number,
  quantity: number,
  allowBackorder: boolean,
) {
  return stock >= quantity || allowBackorder;
}
