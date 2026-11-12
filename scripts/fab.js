import { MODULE_ID } from "./constants.js";
import { t, tn } from "./i18n.js";
import { allPhones, getLog, getPhoneData, holders, isFixed, isPager, landlineUsers, modeOf, modelOf, playerUnread } from "./devices.js";
import { gmIncoming } from "./gm-actions.js";
import { elapsed, liveCalls, liveOn } from "./live-call.js";
import { openPanel, openPhone } from "./main.js";
import { activeCall } from "./player-calls.js";
/* -------------------------------------------- */
/*  Floating button (players, and GM network)   */
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

/** Device opened by the main button: the last one chosen, a phone rather than a pager. */
function mainDevice(personal) {
  const phones = personal.filter((p) => !isPager(p.phone));
  return phones.find((p) => p.item.uuid === loadLastDevice()) ?? phones[0] ?? personal[0] ?? null;
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
  if (game.user.isGM) return updateGmFab();
  let fab = document.getElementById("spt-phone-fab");
  const mine = myPhones();
  const personal = mine.filter((p) => !isFixed(p.phone));
  // Room buttons only for installed devices in the room where the agent is (not a shared one used from afar).
  const rooms = mine.filter((p) => isFixed(p.phone) && landlineUsers(p.phone).some((u) => u.id === game.user.id));
  const wanted = !game.user.isGM && game.settings.get(MODULE_ID, "floatingButton") && personal.length + rooms.length > 0;
  if (!wanted) return fab?.remove();
  if (!fab) fab = createFab();
  const ringingUuid = activeCall?.itemUuid ?? null;
  const ringsHere = (p) => !!activeCall && p.item.uuid === ringingUuid;

  // On the line: the button of the device in use turns green with the call's timer.
  const onLine = (p) => {
    const d = liveOn(p.item.uuid);
    return d && !d.ended && !d.dialing ? d : null;
  };
  const livePersonal = personal.find(onLine);

  // Main button: personal devices.
  let main = fab.querySelector(".spt-fab-main");
  if (!main) fab.prepend((main = fabButton("spt-fab-main")));
  main.hidden = !personal.length;
  const shown = livePersonal ?? mainDevice(personal);
  const pIcon = modelOf(shown?.phone).icon;
  main.querySelector("i").className = `fas ${pIcon}`;
  setOnLine(main, livePersonal ? onLine(livePersonal) : null);
  main.dataset.liveUuid = livePersonal?.item.uuid ?? "";
  // Switched off: greyed (a click still opens the dark screen and its power button).
  main.classList.toggle("off", !livePersonal && !!shown && modeOf(shown.phone) === "off");
  const n = personal.reduce((sum, p) => sum + playerUnread(p.phone), 0);
  setFabBadge(main, n);
  main.classList.toggle("ringing", !!activeCall && !rooms.some(ringsHere));
  main.title = n ? tn("Unread", n) : t("MyPhone");

  roomButtons(fab, rooms, { unread: (p) => playerUnread(p.phone), ringing: ringsHere, live: onLine });
  orient(fab);
}

/** Green button and running timer while on the line. */
function setOnLine(btn, data) {
  btn.classList.toggle("online", !!data);
  let timer = btn.querySelector(".spt-fab-timer");
  if (!data) return timer?.remove();
  if (!timer) {
    timer = document.createElement("span");
    timer.className = "spt-fab-timer";
    btn.appendChild(timer);
  }
  timer.dataset.call = data.callId;
  timer.textContent = elapsed(data);
  startFabTicker();
}

let fabTicker = null;
function startFabTicker() {
  if (fabTicker) return;
  fabTicker = setInterval(() => {
    const timers = document.querySelectorAll("#spt-phone-fab .spt-fab-timer");
    if (!timers.length) {
      clearInterval(fabTicker);
      fabTicker = null;
      return;
    }
    for (const el of timers) {
      const data = liveCalls.get(el.dataset.call);
      if (data && !data.ended) el.textContent = elapsed(data);
    }
  }, 1000);
}

/** Near the bottom of the screen, the buttons line up to the right of the main one instead of stacking down. */
function orient(fab) {
  const r = fab.getBoundingClientRect();
  // The edge the group is anchored by stays put when the layout changes, so the choice is stable.
  const anchoredTop = fab.style.top && fab.style.top !== "auto";
  const y = anchoredTop ? r.top : r.bottom;
  fab.classList.toggle("spt-fab-row", y > window.innerHeight * 0.6);
}

/** Small buttons under the main one, one per installed device (landline, terminal). */
function roomButtons(fab, rooms, { unread, ringing = () => false, live = () => null }) {
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
    const u = unread(p);
    setFabBadge(b, u);
    b.classList.toggle("ringing", ringing(p));
    setOnLine(b, live(p));
    b.title = `${p.phone.label} — ${game.scenes.get(p.phone.sceneId)?.name ?? ""}${u ? ` (${tn("Unread", u)})` : ""}`;
  }
}

/** Agents' messages the GM has not opened yet (same count as the Messages tab). */
function gmUnread(phones = allPhones()) {
  let n = 0;
  for (const p of phones) {
    for (const e of getLog(p.phone)) if (e.kind === "sms" && e.dir === "out" && !e.pj && !e.prep && e.seen === false) n++;
  }
  return n;
}

/** GM: one telecom button that opens the Network panel (on Messages when something is unread). */
function updateGmFab() {
  let fab = document.getElementById("spt-phone-fab");
  if (!game.settings.get(MODULE_ID, "gmFloatingButton")) return fab?.remove();
  if (!fab) fab = createFab();
  let main = fab.querySelector(".spt-fab-main");
  if (!main) fab.prepend((main = fabButton("spt-fab-main")));
  main.dataset.gm = "1";
  main.querySelector("i").className = "fas fa-tower-cell";
  const n = gmUnread();
  setFabBadge(main, n);
  // An agent is calling you: orange, and a click brings the call window back.
  const calling = gmIncoming.size > 0;
  main.classList.toggle("calling", calling);
  main.title = calling ? t("Gm.AgentCalling") : n ? tn("Unread", n) : t("Gm.PanelTitle");
  // Devices installed on the scene the GM is viewing: one click opens their GM view.
  const sceneId = canvas?.scene?.id ?? game.user.viewedScene;
  const rooms = sceneId ? allPhones().filter((p) => isFixed(p.phone) && p.phone.sceneId === sceneId) : [];
  roomButtons(fab, rooms, { unread: (p) => gmUnread([p]) });
  orient(fab);
}

/** GM: the incoming call window comes forward (closing it would mean "no answer"). */
function showGmCall() {
  const call = [...gmIncoming.values()].find((c) => c.dialog);
  if (!call) return false;
  call.dialog.maximize?.();
  call.dialog.bringToFront?.();
  return true;
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
      orient(fab);
    } else if (drag.btn?.dataset.gm) {
      if (!showGmCall()) openPanel(gmUnread() ? { tab: "inbox" } : {});
    } else if (drag.btn) {
      // On the line: back to the device in use.
      let uuid = drag.btn.dataset.uuid || drag.btn.dataset.liveUuid;
      if (!uuid) {
        // Main phone: the last personal device chosen.
        const personal = myPhones().filter((p) => !isFixed(p.phone));
        uuid = mainDevice(personal)?.item.uuid;
      }
      if (uuid) {
        if (!game.user.isGM && !isPager(getPhoneData(fromUuidSync(uuid)))) saveLastDevice(uuid);
        openPhone(uuid);
      }
    }
    drag = null;
  });
  document.body.appendChild(fab);
  return fab;
}

