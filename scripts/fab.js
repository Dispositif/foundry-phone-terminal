import { MODULE_ID } from "./constants.js";
import { t, tn } from "./i18n.js";
import { allPhones, holders, isFixed, modelOf, unreadCount } from "./devices.js";
import { openPhone } from "./main.js";
import { activeCall } from "./player-calls.js";
/* -------------------------------------------- */
/*  Floating button (players)                   */
/* -------------------------------------------- */

/** Current player's devices (same rule as for ringing). */
export function myPhones() {
  return allPhones().filter((p) => holders(p).some((u) => u.id === game.user.id));
}

export const FAB_POS_KEY = `${MODULE_ID}.fabPos`;

/** Last device chosen by this player (restored on next opening). */
export function lastDeviceKey() {
  return `${MODULE_ID}.lastDevice.${game.world?.id}.${game.user?.id}`;
}
export function loadLastDevice() {
  try {
    return localStorage.getItem(lastDeviceKey());
  } catch {
    return null;
  }
}
export function saveLastDevice(uuid) {
  try {
    localStorage.setItem(lastDeviceKey(), uuid);
  } catch {}
}

export function fabButton(cls) {
  const b = document.createElement("div");
  b.className = `spt-fab ${cls}`;
  b.innerHTML = `<i class="fas"></i><span class="spt-fab-badge" hidden>0</span>`;
  return b;
}

export function setFabBadge(btn, n) {
  const badge = btn.querySelector(".spt-fab-badge");
  badge.textContent = n > 9 ? "9+" : String(n);
  badge.hidden = n === 0;
}

/**
 * Floating button: the agent's phone, and below it a small button per device
 * installed in the room where the agent stands (landline, terminal), shown while they are there.
 */
export function updateFab() {
  if (!game.ready) return;
  let fab = document.getElementById("spt-phone-fab");
  const mine = myPhones();
  const wanted = !game.user.isGM && game.settings.get(MODULE_ID, "floatingButton") && mine.length > 0;
  if (!wanted) return fab?.remove();
  if (!fab) fab = createFab();
  const personal = mine.filter((p) => !isFixed(p.phone));
  const rooms = mine.filter((p) => isFixed(p.phone));
  const ringingUuid = activeCall?.itemUuid ?? null;
  const ringsHere = (p) => !!activeCall && p.item.uuid === ringingUuid;

  // Main button: personal devices.
  let main = fab.querySelector(".spt-fab-main");
  if (!main) fab.prepend((main = fabButton("spt-fab-main")));
  main.hidden = !personal.length;
  const pIcon = modelOf((personal.find((p) => p.item.uuid === loadLastDevice()) ?? personal[0])?.phone).icon;
  main.querySelector("i").className = `fas ${pIcon}`;
  const n = personal.reduce((sum, p) => sum + unreadCount(p.phone), 0);
  setFabBadge(main, n);
  main.classList.toggle("ringing", !!activeCall && !rooms.some(ringsHere));
  main.title = n ? tn("Unread", n) : t("MyPhone");

  // Room buttons.
  const keep = new Set(rooms.map((p) => p.item.uuid));
  for (const b of fab.querySelectorAll(".spt-fab-room")) if (!keep.has(b.dataset.uuid)) b.remove();
  for (const p of rooms) {
    let b = [...fab.querySelectorAll(".spt-fab-room")].find((x) => x.dataset.uuid === p.item.uuid);
    if (!b) {
      b = fabButton("spt-fab-room");
      b.dataset.uuid = p.item.uuid;
      fab.appendChild(b);
    }
    b.querySelector("i").className = `fas ${modelOf(p.phone).icon}`;
    const u = unreadCount(p.phone);
    setFabBadge(b, u);
    b.classList.toggle("ringing", ringsHere(p));
    b.title = `${p.phone.label} — ${game.scenes.get(p.phone.sceneId)?.name ?? ""}${u ? ` (${tn("Unread", u)})` : ""}`;
  }
}

export function createFab() {
  const fab = document.createElement("div");
  fab.id = "spt-phone-fab";
  try {
    const pos = JSON.parse(localStorage.getItem(FAB_POS_KEY) ?? "null");
    if (pos) Object.assign(fab.style, { left: `${pos.left}px`, top: `${pos.top}px`, bottom: "auto" });
  } catch {}
  // Click = open the button's device; drag = move the group (position remembered).
  let drag = null;
  fab.addEventListener("pointerdown", (ev) => {
    const r = fab.getBoundingClientRect();
    drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, moved: false, btn: ev.target.closest(".spt-fab") };
    fab.setPointerCapture(ev.pointerId);
  });
  fab.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const left = Math.max(0, Math.min(window.innerWidth - fab.offsetWidth, ev.clientX - drag.dx));
    const top = Math.max(0, Math.min(window.innerHeight - fab.offsetHeight, ev.clientY - drag.dy));
    if (!drag.moved && Math.hypot(left - fab.offsetLeft, top - fab.offsetTop) < 4) return;
    drag.moved = true;
    Object.assign(fab.style, { left: `${left}px`, top: `${top}px`, bottom: "auto" });
  });
  fab.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) {
      try {
        localStorage.setItem(FAB_POS_KEY, JSON.stringify({ left: fab.offsetLeft, top: fab.offsetTop }));
      } catch {}
    } else if (drag.btn) {
      let uuid = drag.btn.dataset.uuid;
      if (!uuid) {
        // Main phone: the last personal device chosen.
        const personal = myPhones().filter((p) => !isFixed(p.phone));
        uuid = (personal.find((p) => p.item.uuid === loadLastDevice()) ?? personal[0])?.item.uuid;
      }
      if (uuid) {
        saveLastDevice(uuid);
        openPhone(uuid);
      }
    }
    drag = null;
  });
  document.body.appendChild(fab);
  return fab;
}

