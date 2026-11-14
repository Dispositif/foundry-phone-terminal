import { ApplicationV2, MODULE_ID } from "./constants.js";
import { allPhones, deviceItemPatch } from "./devices.js";
import { openPhone } from "./main.js";
/* -------------------------------------------- */
/*  Item sheet: open the device                 */
/* -------------------------------------------- */

/**
 * "Sheet" of a device item: instead of an empty item window, a click opens the device
 * (the phone for the player, the GM view for the GM). The system sheet stays available
 * from the GM view.
 */
export class PhoneSheet extends foundry.applications.sheets.ItemSheetV2 {
  async render() {
    openPhone(this.document.uuid);
    return this;
  }
}

export function registerPhoneSheet() {
  const config = foundry.applications.apps?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig;
  config.registerSheet(Item, MODULE_ID, PhoneSheet, { makeDefault: false, label: "SPT.Sheet.Label" });
}

/** Opens the system's (default) item sheet, bypassing the "device" sheet. */
export function openSystemSheet(item) {
  const entries = Object.values(CONFIG.Item.sheetClasses?.[item.type] ?? {}).filter((s) => s.cls !== PhoneSheet);
  const cls = (entries.find((s) => s.default) ?? entries[0])?.cls;
  if (!cls) return;
  const sheet = cls.prototype instanceof ApplicationV2 ? new cls({ document: item }) : new cls(item);
  sheet.render(true);
}

/** Existing devices: the GM sets the "device" sheet, model icon and description where nothing was chosen. */
export async function ensureDeviceItems() {
  for (const { item, phone } of allPhones({ jammers: true })) {
    const patch = deviceItemPatch(item, phone);
    if (Object.keys(patch).length) await item.update(patch);
  }
}
