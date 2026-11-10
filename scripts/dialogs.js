import { DialogV2, MODULE_ID } from "./constants.js";
import { DEFAULT_THEME, MODELS, directoryText, THEMES, createPhone, newTheme, getLog, getPhoneData, markPhone, phoneUsers, randomAddress } from "./devices.js";
import { grantAttachments } from "./messages.js";
import { esc, norm } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Dialogs (GM, and contacts for the player)    */
/* -------------------------------------------- */

export async function phoneFormDialog({ title, selectHtml = "", label = null, number = null, model = "smartphone", sceneId = null, theme = null, withModel = true }) {
  // Default name = model label, as long as the GM has not changed it.
  const autoLabel = label === null;
  label ??= MODELS[model]?.label ?? MODELS.smartphone.label;
  const autoNumber = number === null;
  number ??= randomAddress(model);
  const modelOpts = Object.entries(MODELS)
    .map(([k, m]) => `<option value="${k}" ${k === model ? "selected" : ""}>${m.label}</option>`)
    .join("");
  // A landline has no "default" choice: modern (new devices) or vintage (rotary dial, also the old "default").
  const notLandline = Object.keys(MODELS).filter((k) => k !== "landline").join(" ");
  const current = theme ?? newTheme(model);
  const shown = model === "landline" && current === DEFAULT_THEME ? "vintage" : current;
  const themeOpts = [DEFAULT_THEME, ...Object.keys(THEMES)]
    .map((k) => `<option value="${k}" data-models="${k === DEFAULT_THEME ? notLandline : THEMES[k].models.join(" ")}" ${k === shown ? "selected" : ""}>${t(`Theme.${k}`)}</option>`)
    .join("");
  const scenes = game.scenes.map((sc) => `<option value="${esc(sc.name)}">`).join("");
  const sceneName = game.scenes.get(sceneId)?.name ?? canvas?.scene?.name ?? "";
  return DialogV2.wait({
    window: { title, icon: "fas fa-mobile-screen" },
    position: { width: 400 },
    content: `<div class="spt-phone-form">
        ${withModel ? `<div class="form-group"><label>${t("Form.Model")}</label><select name="model">${modelOpts}</select></div>` : ""}
        <div class="spt-if-mobile">${selectHtml}</div>
        <div class="form-group spt-if-landline"><label>${t("Form.Place")}</label>
          <input type="text" name="scene" list="spt-scenes" value="${esc(sceneName)}" placeholder="${t("Form.SceneName")}">
          <datalist id="spt-scenes">${scenes}</datalist></div>
        <div class="form-group"><label>${t("Form.DeviceName")}</label><input type="text" name="label" value="${esc(label)}" placeholder="${t("Form.DeviceNameHint")}"></div>
        <div class="form-group"><label>${t("Form.Number")}</label><input type="text" name="number" value="${esc(number)}"></div>
        <div class="form-group"><label>${t("Form.Theme")}</label><select name="theme">${themeOpts}</select></div>
      </div>`,
    render: (event, x) => {
      // v13+: (event, dialog); an HTML element is accepted too.
      const root = x?.element ?? x;
      const select = root?.querySelector?.("[name=model]");
      const labelInput = root?.querySelector?.("[name=label]");
      let lastAuto = autoLabel ? labelInput?.value : null;
      select?.addEventListener("change", () => {
        if (!labelInput || lastAuto === null || labelInput.value !== lastAuto) return;
        labelInput.value = lastAuto = MODELS[select.value]?.label ?? lastAuto;
      });
      // Random number not edited yet: it follows the model (number or email address).
      const numberInput = root?.querySelector?.("[name=number]");
      let lastNumber = autoNumber ? numberInput?.value : null;
      select?.addEventListener("change", () => {
        if (!numberInput || lastNumber === null || numberInput.value !== lastNumber) return;
        if (!!MODELS[select.value]?.mail === lastNumber.includes("@")) return;
        numberInput.value = lastNumber = randomAddress(select.value);
      });
      const sync = () => {
        const landline = !!MODELS[select?.value ?? model]?.fixed;
        root.querySelector(".spt-if-landline")?.classList.toggle("hidden", !landline);
        root.querySelector(".spt-if-mobile")?.classList.toggle("hidden", landline);
        // Looks: only those that fit the chosen model.
        const m = select?.value ?? model;
        const themeSel = root.querySelector("[name=theme]");
        for (const o of themeSel?.options ?? []) {
          const ok = !o.dataset.models || o.dataset.models.split(" ").includes(m);
          o.hidden = o.disabled = !ok;
          if (!ok && o.selected) themeSel.value = newTheme(m);
        }
      };
      select?.addEventListener("change", sync);
      sync();
    },
    buttons: [
      {
        action: "ok",
        label: t("Ok"),
        icon: "fas fa-check",
        default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          const model = f.model?.value;
          const sceneName = f.scene?.value?.trim();
          const scene = sceneName ? game.scenes.find((sc) => norm(sc.name) === norm(sceneName)) : null;
          return {
            target: f.target?.value,
            label: f.label.value.trim() || (MODELS[model]?.label ?? MODELS.smartphone.label),
            number: f.number.value.trim() || randomAddress(model),
            model,
            sceneName,
            theme: f.theme?.value ?? DEFAULT_THEME,
            sceneId: MODELS[model]?.fixed ? scene?.id ?? null : undefined
          };
        }
      },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

export function playerActors() {
  return game.actors.filter((a) => game.users.some((u) => !u.isGM && a.testUserPermission(u, "OWNER")));
}

/**
 * "Holder" field: free input with suggestions (agents first, then NPCs).
 * Empty = nobody (world item). Avoids a long dropdown of NPCs.
 */
export function holderField(current = "") {
  const pcs = playerActors();
  const npcs = game.actors.filter((a) => !pcs.includes(a)).sort((a, b) => a.name.localeCompare(b.name));
  const opts = [...pcs, ...npcs].map((a) => `<option value="${esc(a.name)}">`).join("");
  return `<div class="form-group"><label>${t("Form.HeldBy")}</label>
      <input type="text" name="target" list="spt-holders" value="${esc(current)}" placeholder="${t("Form.Nobody")}">
      <datalist id="spt-holders">${opts}</datalist></div>
    <p class="hint">${t("Form.HeldByHint")}</p>`;
}

/** Finds the typed actor (null = nobody, undefined = not found). */
export function resolveHolder(name) {
  name = name?.trim();
  if (!name) return null;
  const n = norm(name);
  return game.actors.find((a) => norm(a.name) === n);
}

export async function newPhoneDialog() {
  const res = await phoneFormDialog({
    title: t("NewDevice"),
    selectHtml: holderField()
  });
  if (!res) return;
  if (MODELS[res.model]?.fixed) {
    if (!res.sceneId) return ui.notifications.warn(t("Warn.SceneNotFound", { name: res.sceneName ?? "" }));
    const item = await createPhone(null, res);
    ui.notifications.info(`📍 ${t("Info.Installed", { model: MODELS[res.model].label, label: res.label })}`);
    return item;
  }
  const actor = resolveHolder(res.target);
  if (actor === undefined) return ui.notifications.warn(t("Warn.ActorNotFound", { name: res.target }));
  const item = await createPhone(actor, res);
  ui.notifications.info(`📱 ${t("Info.Created", { label: res.label, number: res.number })}`);
  return item;
}

/** Gives the device to another holder (or back to world items), history included. */
export async function transferPhone(item, actor) {
  if ((item.parent ?? null) === (actor ?? null)) return item;
  const data = item.toObject();
  delete data._id;
  const created = await Item.create(data, actor ? { parent: actor, spt: true } : { spt: true });
  await item.delete();
  const atts = getLog(getPhoneData(created), { includePending: true }).map((e) => e.att).filter(Boolean);
  if (actor && atts.length) await grantAttachments(atts, phoneUsers(actor));
  return created;
}

export async function giveDialog(item) {
  const phone = getPhoneData(item);
  const res = await DialogV2.wait({
    window: { title: t("Give.Title", { label: phone.label, number: phone.number }), icon: "fas fa-hand-holding" },
    position: { width: 380 },
    content: `<div class="spt-phone-form">${holderField()}
      <p class="hint">${t("Give.Hint")}</p></div>`,
    buttons: [
      { action: "ok", label: t("Give.Give"), icon: "fas fa-check", default: true, callback: (event, button) => button.form.elements.target.value },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (res === null || res === undefined) return;
  const actor = resolveHolder(res);
  if (actor === undefined) return ui.notifications.warn(t("Warn.ActorNotFound", { name: res }));
  await transferPhone(item, actor);
  ui.notifications.info(`📱 ${actor ? t("Give.NowHeld", { label: phone.label, name: actor.name }) : t("Give.NowWorld", { label: phone.label })}`);
}

export async function editPhoneDialog(item) {
  const phone = getPhoneData(item);
  const res = await phoneFormDialog({
    title: `${t("EditDevice")} — ${item.name}`,
    label: phone.label,
    number: phone.number,
    model: phone.model ?? "smartphone",
    sceneId: phone.sceneId,
    theme: phone.theme ?? null
  });
  if (!res) return;
  if (MODELS[res.model]?.fixed && !res.sceneId) return ui.notifications.warn(t("Warn.SceneNotFound", { name: res.sceneName ?? "" }));
  await markPhone(item, res);
}

/** Contacts: one per line, "Name | number" (number optional). */
export async function contactsDialog(item) {
  const phone = getPhoneData(item);
  const text = (phone.contacts ?? []).map((c) => (c.number ? `${c.name} | ${c.number}` : c.name)).join("\n");
  const res = await DialogV2.wait({
    window: { title: `${t("Contacts.Title")} — ${item.parent?.name ?? ""} (${phone.label})`, icon: "fas fa-address-book", resizable: true },
    classes: ["spt-text-dialog"],
    position: { width: 480, height: 420 },
    content: `<div class="spt-phone-form">
        <p class="hint">${t("Contacts.Hint")}</p>
        <textarea name="contacts" rows="8" placeholder="${t("Contacts.Placeholder")}">${esc(text)}</textarea>
      </div>`,
    buttons: [
      { action: "ok", label: t("Save"), icon: "fas fa-check", default: true, callback: (event, button) => button.form.elements.contacts.value },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (res === null || res === undefined) return;
  const contacts = res
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter(([name]) => name)
    .map(([name, number]) => ({ name, number: number || "" }));
  await item.update({ [`flags.${MODULE_ID}.phone.contacts`]: contacts });
}


/** Names a correspondent: adds a contact with this number (or address). */
export async function addContactDialog(item, key) {
  const name = await DialogV2.prompt({
    window: { title: t("Contacts.Add"), icon: "fas fa-user-plus" },
    position: { width: 340 },
    content: `<div class="spt-phone-form">
        <label>${t("Contacts.Name")} <input type="text" name="name" autofocus></label>
        <p class="hint">${esc(key)}</p>
      </div>`,
    ok: { label: t("Save"), icon: "fas fa-check", callback: (event, button) => button.form.elements.name.value.trim() },
    rejectClose: false
  });
  if (!name) return;
  const phone = getPhoneData(item);
  const contacts = [...(phone.contacts ?? []), { name, number: key }];
  await item.update({ [`flags.${MODULE_ID}.phone.contacts`]: contacts });
}

/** GM: the NPC directory, edited as text like contacts. */
export async function directoryDialog() {
  const res = await DialogV2.wait({
    window: { title: t("Directory.Title"), icon: "fas fa-book-open", resizable: true },
    classes: ["spt-text-dialog"],
    position: { width: 640, height: 560 },
    content: `<div class="spt-phone-form">
        <p class="hint">${t("Directory.Hint")}</p>
        <textarea name="directory" rows="16" placeholder="${t("Directory.Placeholder")}">${esc(directoryText())}</textarea>
      </div>`,
    buttons: [
      { action: "ok", label: t("Save"), icon: "fas fa-check", default: true, callback: (event, button) => button.form.elements.directory.value },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (res === null || res === undefined) return;
  await game.settings.set(MODULE_ID, "directory", res.trim());
}
