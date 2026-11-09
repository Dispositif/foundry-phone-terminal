import { MODULE_ID } from "./constants.js";
import { addLog, allPhones, createPhone } from "./devices.js";
import { t } from "./i18n.js";
import { randomNumber } from "./util.js";

/* -------------------------------------------- */
/*  Démo : appareils de test (MJ)               */
/* -------------------------------------------- */

/**
 * Crée de quoi tester vite : un smartphone par personnage assigné qui n'a pas d'appareil,
 * un fixe et un terminal sur la scène affichée, un mobile de PNJ avec un message préparé.
 * Tout est marqué « démo » et se retire avec removeDemo().
 */
export async function createDemo() {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlyPanel"));
  const created = [];
  for (const u of game.users.filter((x) => !x.isGM && x.character)) {
    const actor = u.character;
    if (allPhones().some((p) => p.actor === actor)) continue;
    created.push(await createPhone(actor, { label: t("Model.smartphone"), number: randomNumber(), model: "smartphone" }));
  }
  const scene = canvas?.scene;
  if (scene) {
    created.push(await createPhone(null, { label: t("Demo.Landline"), number: "555-0100", model: "landline", sceneId: scene.id }));
    created.push(await createPhone(null, { label: t("Demo.Terminal"), number: "archives@demo.net", model: "desktop", sceneId: scene.id }));
  }
  const npc = await createPhone(null, { label: t("Demo.NpcPhone"), number: "555-0199", model: "mobile" });
  created.push(npc);
  for (const item of created.filter(Boolean)) await item.setFlag(MODULE_ID, "demo", true);
  await addLog(npc, { kind: "sms", dir: "in", with: "555-0142", text: t("Demo.SampleText"), read: true, prep: true });
  ui.notifications.info(t("Demo.Created", { n: created.filter(Boolean).length }));
}

export async function removeDemo() {
  if (!game.user.isGM) return;
  const items = allPhones()
    .map((p) => p.item)
    .filter((i) => i.getFlag(MODULE_ID, "demo"));
  for (const item of items) await item.delete();
  ui.notifications.info(t("Demo.Removed", { n: items.length }));
}
