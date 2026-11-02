// How many of each product color are on the shelf, and when the next shipment
// lands (Product Bible Section 10). Stock changes, so check_availability reads
// it fresh every time instead of remembering it.
// This is the only file that knows where stock is kept, so swapping the JSON
// file for something else later means changing only readInventory().
import data from "./data/inventory.json";

/** One row of stock, named like the database columns it will come from. */
export type InventoryRow = {
  sku: string;
  product: string;
  color: string;
  units_in_stock: number;
  next_shipment: string;
};

/** Every stock row, or `null` when stock can't be read right now. */
export async function readInventory(): Promise<InventoryRow[] | null> {
  return structuredClone(data.inventory);
}
