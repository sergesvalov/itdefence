// Generates every in-game sprite as an SVG into public/assets/sprites/.
//
//   node tools/generate-art.mjs
//
// One style for everything: flat fills, a thick dark outline, a shared
// palette, light from the top-left (a darker band on the right side of each
// volume) and the same "front view, slightly from above" angle. Edit the
// drawing functions below and re-run — never edit the .svg files by hand.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'sprites');

// ─── Palette ────────────────────────────────────────────────────────────
const INK = '#1a2330';       // outline
const SKIN = '#f6c9a4';
const WOOD = '#b98552';
const WOOD_DARK = '#8a5a34';
const WOOD_LIGHT = '#d3a26b';
const STEEL = '#eef2f6';
const STEEL_SHADE = '#cdd6e0';
const SLATE = '#3b4a63';
const SLATE_DARK = '#2b3a4d';
const GOLD = '#f1c453';
const RED = '#e85d5d';
const TEAL = '#5eead4';
const PAPER = '#f4f1e6';
const GINGER = '#c8642a';       // Вася
const FRECKLE = '#b5754f';
const PERM = '#d9a441';         // Марья Ивановна's hairdo
const CARDIGAN = '#b56576';

// ─── Helpers ────────────────────────────────────────────────────────────
const svg = (w, h, body, strokeWidth = 4) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
  `<g stroke="${INK}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>\n`;

const rect = (x, y, w, h, fill, rx = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
/** Unstroked detail (shade bands, highlights, screens) */
const flat = (x, y, w, h, fill, rx = 0, extra = '') => rect(x, y, w, h, fill, rx, `stroke="none" ${extra}`);
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const dot = (cx, cy, r, fill, extra = '') => circle(cx, cy, r, fill, `stroke="none" ${extra}`);
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, color = INK, width = 4, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
/** A thick coloured limb with the standard outline around it */
const limb = (x1, y1, x2, y2, color, width) =>
  line(x1, y1, x2, y2, INK, width + 7) + line(x1, y1, x2, y2, color, width);
const shadow = (cx, cy, rx, ry = 8) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="0.25" stroke="none"/>`;

// ─── Towers (128×128) ───────────────────────────────────────────────────
const cooler = () => svg(128, 128,
  shadow(64, 116, 38) +
  rect(44, 8, 40, 48, '#a6dcfb', 12) +                    // bottle
  flat(47, 24, 34, 30, '#4aa8e8', 9) +                    // water
  flat(51, 14, 6, 30, '#fff', 3, 'opacity="0.65"') +
  rect(54, 50, 20, 10, STEEL_SHADE) +                     // neck
  rect(34, 58, 60, 56, STEEL, 8) +                        // body
  flat(78, 61, 13, 50, STEEL_SHADE, 6) +
  rect(44, 68, 36, 20, SLATE_DARK, 4) +                   // tap panel
  flat(49, 74, 9, 9, RED, 2) + flat(66, 74, 9, 9, '#4aa8e8', 2) +
  rect(44, 96, 36, 8, '#9aa7b5', 3));                     // drip tray

const router = () => svg(128, 128,
  shadow(64, 110, 46) +
  path('M42 34 A30 30 0 0 1 86 34', 'none', 'stroke="#a78bfa" stroke-width="6"') +
  path('M51 46 A18 18 0 0 1 77 46', 'none', 'stroke="#a78bfa" stroke-width="6"') +
  dot(64, 57, 5, '#a78bfa') +
  line(32, 72, 22, 30, INK, 9) + line(96, 72, 106, 30, INK, 9) +   // antennas
  circle(22, 28, 6, '#7c5ce7') + circle(106, 28, 6, '#7c5ce7') +
  rect(16, 68, 96, 36, SLATE, 10) +
  flat(21, 72, 86, 8, '#54678a', 4) +
  dot(34, 91, 4.5, '#4ade80') + dot(48, 91, 4.5, '#4ade80') + dot(62, 91, 4.5, GOLD) + dot(76, 91, 4.5, RED) +
  line(90, 88, 102, 88, '#54678a', 3) + line(90, 95, 102, 95, '#54678a', 3));

const docs = () => {
  const books = [
    [22, 96, 84, '#0f9d7a'], [30, 78, 72, '#17b890'], [20, 60, 86, '#0c8566'],
    [28, 42, 74, '#1fc49a'], [24, 24, 80, '#12a37f'],
  ];
  return svg(128, 128,
    shadow(64, 116, 44) +
    books.map(([x, y, w, color]) =>
      rect(x, y, w, 18, color, 4) +
      flat(x + w - 15, y + 3, 11, 12, PAPER, 2) +
      flat(x + 8, y + 5, 20, 8, GOLD, 2)).join('') +
    circle(78, 33, 6, RED));                                // "approved" stamp
};

const coffee = () => svg(128, 128,
  shadow(64, 117, 42) +
  rect(24, 104, 80, 12, '#5e3820', 5) +                   // base
  rect(28, 24, 72, 86, '#7a4a2b', 10) +
  flat(84, 34, 13, 72, '#5e3820', 6) +
  rect(24, 14, 80, 18, '#9a6238', 8) +                    // top cap
  dot(44, 43, 5, RED) + dot(58, 43, 5, GOLD) + flat(70, 38, 20, 10, '#4ade80', 2) +
  rect(40, 54, 44, 46, '#2a1a10', 6) +                    // alcove
  rect(56, 54, 12, 10, '#b9c2cc') +                       // nozzle
  path('M50 76 h24 l-3 20 h-18 z', '#fff') +              // cup
  path('M74 80 q9 3 3 12', 'none'));

const aircon = () => svg(128, 128,
  shadow(64, 119, 32, 7) +
  path('M24 28 q-10 7 0 14', 'none', 'stroke="#9be7ff" stroke-width="5"') +   // airflow
  path('M104 28 q10 7 0 14', 'none', 'stroke="#9be7ff" stroke-width="5"') +
  rect(36, 10, 56, 106, STEEL, 12) +
  flat(78, 14, 11, 98, STEEL_SHADE, 6) +
  rect(44, 20, 36, 34, SLATE_DARK, 6) +                   // vent
  [28, 37, 46].map(y => line(50, y, 74, y, '#8fd3f4', 4)).join('') +
  flat(52, 62, 20, 10, '#9af0ea', 3) +
  [0, 60, 120].map(a => line(52, 92, 72, 92, '#38bdf8', 5, `transform="rotate(${a} 62 92)"`)).join(''));  // snowflake

const partner = () => svg(128, 128,
  shadow(64, 117, 54) +
  path('M38 92 q0 -32 26 -32 q26 0 26 32 z', '#2fbf8f') +                    // hoodie
  circle(64, 42, 18, SKIN) +
  path('M46 42 q-2 -24 18 -24 q22 0 18 24 q-5 -12 -11 -9 q-4 -7 -10 0 q-8 -4 -15 9 z', GINGER) +
  dot(57, 45, 2.6, INK) + dot(71, 45, 2.6, INK) +
  dot(52, 50, 1.2, FRECKLE) + dot(55, 52, 1.2, FRECKLE) + dot(73, 52, 1.2, FRECKLE) + dot(76, 50, 1.2, FRECKLE) +
  path('M58 52 q6 5 12 0', 'none', 'stroke-width="3"') +
  rect(42, 62, 44, 26, '#4a5a70', 4) + dot(64, 75, 4.5, '#9af0ea') +          // laptop lid
  rect(94, 72, 13, 14, '#fff', 3) +                                           // mug
  rect(8, 84, 112, 14, '#c98b4f', 5) +                                        // desk top
  rect(14, 96, 100, 20, '#a76d38', 3));

// ─── Furniture (128×128) ────────────────────────────────────────────────
const cabinet = () => svg(128, 128,
  shadow(64, 119, 38, 7) +
  rect(30, 8, 68, 108, WOOD_DARK, 6) +
  flat(32, 10, 64, 11, '#a8733f', 5) +
  rect(36, 26, 26, 84, '#9c6a3c', 3, 'stroke-width="3"') +
  rect(66, 26, 26, 84, '#9c6a3c', 3, 'stroke-width="3"') +
  flat(56, 62, 4, 14, GOLD, 2) + flat(68, 62, 4, 14, GOLD, 2));

const drawer = () => svg(128, 128,
  shadow(64, 113, 44) +
  rect(52, 20, 16, 14, '#e2725b', 2) +                    // plant pot
  `<ellipse cx="60" cy="14" rx="6" ry="9" fill="#3fb77a"/>` +
  rect(22, 40, 84, 70, WOOD, 6) +
  flat(92, 48, 12, 60, '#a8733f', 5) +
  rect(18, 32, 92, 14, WOOD_LIGHT, 6) +
  [52, 70, 88].map(y => rect(30, y, 58, 14, '#c9965f', 3, 'stroke-width="3"') + dot(59, y + 7, 3.5, GOLD)).join(''));

const sofa = () => svg(128, 128,
  shadow(64, 111, 58) +
  rect(22, 100, 9, 9, WOOD_DARK) + rect(97, 100, 9, 9, WOOD_DARK) +
  rect(14, 32, 100, 54, '#4a7a9b', 14) +                  // back
  rect(70, 42, 22, 18, GOLD, 5, 'transform="rotate(10 81 51)"') +   // pillow
  rect(18, 88, 92, 14, '#3d6886', 5) +                    // base
  rect(24, 64, 40, 26, '#6a9cc0', 8) + rect(64, 64, 40, 26, '#6a9cc0', 8) +
  rect(6, 54, 22, 48, '#3d6886', 10) + rect(100, 54, 22, 48, '#3d6886', 10));

// ─── Petya's desk, seen over his shoulder (156×140) ─────────────────────
const monitor = (x, screen) =>
  rect(x + 21, 44, 8, 8, '#55657a') +
  rect(x, 8, 50, 38, '#1c2a3a', 5) + flat(x + 4, 12, 42, 30, '#0f3b46', 3) + screen;

const desk = () => svg(156, 140,
  shadow(78, 130, 68, 9) +
  rect(8, 42, 140, 56, '#c98b4f', 8) +                    // desk surface
  flat(12, 86, 132, 9, '#a76d38', 4) +
  monitor(26,
    line(31, 19, 55, 19, TEAL, 2.5) + line(31, 25, 47, 25, TEAL, 2.5) +
    line(35, 31, 61, 31, GOLD, 2.5) + line(31, 37, 43, 37, TEAL, 2.5)) +
  monitor(80,
    flat(88, 28, 6, 12, TEAL) + flat(98, 20, 6, 20, GOLD) + flat(108, 24, 6, 16, TEAL) + flat(118, 16, 6, 24, RED)) +
  rect(52, 58, 52, 14, SLATE_DARK, 3) +                   // keyboard
  line(57, 63, 99, 63, TEAL, 2, 'stroke-dasharray="3 3" opacity="0.7"') +
  line(57, 68, 99, 68, TEAL, 2, 'stroke-dasharray="3 3" opacity="0.7"') +
  rect(16, 56, 22, 28, PAPER, 2, 'transform="rotate(-10 27 70)" stroke-width="3"') +
  circle(126, 66, 9, '#fff') + dot(126, 66, 5.5, '#7a4a2b') +   // mug
  limb(50, 110, 60, 74, '#3b6fd0', 11) + limb(106, 110, 96, 74, '#3b6fd0', 11) +
  circle(60, 71, 6, SKIN) + circle(96, 71, 6, SKIN) +
  path('M44 134 q-2 -42 34 -42 q36 0 34 42 z', '#3b6fd0') +                 // hoodie
  circle(61, 84, 4.5, SKIN) + circle(95, 84, 4.5, SKIN) +                  // ears
  circle(78, 82, 17, '#6b4a2f') +                                           // back of head
  path('M66 74 q6 -6 12 -3', 'none', 'stroke="#8a6340" stroke-width="3"') +
  rect(54, 108, 48, 30, SLATE_DARK, 10) + flat(59, 112, 38, 6, SLATE, 3));  // chair back

// ─── Door (124×138) ─────────────────────────────────────────────────────
const doorFrame = (inner) => svg(124, 138,
  path('M10 138 V12 q0 -6 6 -6 h92 q6 0 6 6 V138 z', '#e9e2d0') + inner, 5);

const door = () => doorFrame(
  rect(22, 18, 80, 122, '#b0733f') +
  rect(32, 28, 60, 40, '#c4874f', 3, 'stroke-width="3"') +
  rect(32, 78, 60, 52, '#c4874f', 3, 'stroke-width="3"') +
  flat(44, 38, 36, 18, RED, 3) + flat(49, 43, 26, 3, '#fff') + flat(49, 49, 18, 3, '#fff') +   // door sign
  circle(92, 76, 5.5, GOLD));

const doorOpen = () => doorFrame(
  rect(22, 18, 80, 122, '#121a24') +
  path('M58 138 L102 138 L102 104 Z', '#fff', 'stroke="none" opacity="0.08"') +
  path('M22 18 L48 28 V140 H22 Z', '#8f5a2e') +           // door leaf swung inwards
  circle(42, 82, 4.5, GOLD));

// ─── Tutorial avatar (128×128) ──────────────────────────────────────────
const avatarPetya = () => svg(128, 128,
  circle(64, 64, 60, '#24364a') +
  path('M22 116 q2 -34 42 -34 q40 0 42 34 q-18 12 -42 12 q-24 0 -42 -12 z', '#2f4f8f') +
  rect(56, 74, 16, 14, SKIN) +
  `<ellipse cx="64" cy="54" rx="26" ry="28" fill="${SKIN}"/>` +
  path('M40 66 q24 26 48 0 q-2 16 -24 17 q-22 -1 -24 -17 z', '#d4b393', 'stroke="none"') +   // stubble
  path('M37 50 q-3 -32 27 -32 q31 0 27 32 q-6 -15 -15 -15 q-9 6 -21 2 q-11 0 -18 13 z', '#6b4a2f') +
  rect(42, 50, 19, 14, '#fff', 4, 'fill-opacity="0.3" stroke-width="3"') +
  rect(67, 50, 19, 14, '#fff', 4, 'fill-opacity="0.3" stroke-width="3"') +
  line(61, 56, 67, 56, INK, 3) +
  dot(52, 58, 2.6, INK) + dot(76, 58, 2.6, INK) +
  line(46, 68, 56, 69, '#c79a78', 2.5) + line(72, 69, 82, 68, '#c79a78', 2.5) +             // tired eyes
  line(56, 76, 72, 76, INK, 3));

const avatarVasya = () => svg(128, 128,
  circle(64, 64, 60, '#24364a') +
  path('M22 116 q2 -34 42 -34 q40 0 42 34 q-18 12 -42 12 q-24 0 -42 -12 z', '#2fbf8f') +
  rect(56, 74, 16, 14, SKIN) +
  `<ellipse cx="64" cy="54" rx="26" ry="28" fill="${SKIN}"/>` +
  path('M37 52 q-5 -36 27 -36 q34 0 27 36 q-6 -17 -15 -13 q-6 -10 -15 0 q-12 -6 -24 13 z', GINGER) +
  dot(53, 58, 3, INK) + dot(75, 58, 3, INK) +
  line(46, 49, 58, 47, INK, 3) + line(70, 47, 82, 49, INK, 3) +
  [[47, 66], [51, 69], [55, 66], [73, 66], [77, 69], [81, 66]].map(([x, y]) => dot(x, y, 1.5, FRECKLE)).join('') +
  path('M54 72 q10 9 20 0', '#fff', 'stroke-width="3"'));

const avatarMaria = () => svg(128, 128,
  circle(64, 64, 60, '#24364a') +
  `<ellipse cx="64" cy="40" rx="36" ry="30" fill="${PERM}"/>` +
  path('M22 116 q2 -34 42 -34 q40 0 42 34 q-18 12 -42 12 q-24 0 -42 -12 z', CARDIGAN) +
  rect(56, 74, 16, 14, SKIN) +
  `<ellipse cx="64" cy="56" rx="25" ry="27" fill="${SKIN}"/>` +
  path('M39 52 q4 -22 25 -22 q21 0 25 22 q-12 -12 -25 -10 q-13 -2 -25 10 z', PERM) +
  [50, 57, 64, 71, 78].map((x, i) => dot(x, 92 + (i === 2 ? 3 : i % 2 ? 2 : 0), 3, '#f4f1e6')).join('') +   // beads
  rect(43, 52, 18, 13, '#fff', 5, 'fill-opacity="0.3" stroke-width="3"') +
  rect(67, 52, 18, 13, '#fff', 5, 'fill-opacity="0.3" stroke-width="3"') +
  line(61, 57, 67, 57, INK, 3) +
  dot(52, 59, 2.6, INK) + dot(76, 59, 2.6, INK) +
  line(46, 47, 58, 49, INK, 3) + line(70, 49, 82, 47, INK, 3) +
  path('M57 75 q7 -4 14 0', 'none', 'stroke="#c0392b" stroke-width="4"'));

// ─── Coworkers ──────────────────────────────────────────────────────────
// Chibi proportions: a big head on a short body, drawn head-on. The contact
// shadow is added in-game (CoworkerView), so none is baked in here.
const brows = { angry: 3, worried: -3, flat: 0 };

function person({
  width = 80, bodyHalf = 17, skin = SKIN, shirt, pants, shoes,
  hairBack = () => '', hairFront = () => '', face = 'angry', mouth = 'frown', eye = 2.6,
  torso = () => '', held = () => '', extra = () => '', lean = 0,
}) {
  const cx = width / 2;
  const slant = brows[face];
  const mouths = {
    frown: path(`M${cx - 6} 43 q6 -5 12 0`, 'none', 'stroke-width="3"'),
    flat: line(cx - 5, 42, cx + 5, 42, INK, 3),
    open: `<ellipse cx="${cx}" cy="42" rx="3.5" ry="4.5" fill="#7a2a22" stroke-width="2.5"/>`,
  };
  const body =
    hairBack(cx) +
    rect(cx - 14, 84, 12, 36, pants, 3) + rect(cx + 2, 84, 12, 36, pants, 3) +
    rect(cx - 18, 115, 17, 10, shoes, 5) + rect(cx + 1, 115, 17, 10, shoes, 5) +
    limb(cx - bodyHalf + 3, 60, cx - bodyHalf - 6, 82, shirt, 8) +
    limb(cx + bodyHalf - 3, 60, cx + bodyHalf + 6, 82, shirt, 8) +
    rect(cx - bodyHalf, 50, bodyHalf * 2, 44, shirt, 10) +
    torso(cx) +
    circle(cx - bodyHalf - 6, 84, 5.5, skin) + circle(cx + bodyHalf + 6, 84, 5.5, skin) +
    held(cx) +
    circle(cx - 20, 32, 4.5, skin) + circle(cx + 20, 32, 4.5, skin) +
    circle(cx, 30, 20, skin) +
    hairFront(cx) +
    dot(cx - 7, 33, eye, INK) + dot(cx + 7, 33, eye, INK) +
    line(cx - 12, 25 - slant, cx - 4, 25 + slant, INK, 3) +
    line(cx + 12, 25 - slant, cx + 4, 25 + slant, INK, 3) +
    mouths[mouth] +
    extra(cx);
  return svg(width, 128, lean ? `<g transform="rotate(${lean} ${cx} 124)">${body}</g>` : body);
}

const glasses = (cx) =>
  rect(cx - 14, 28, 12, 10, '#fff', 3, 'fill-opacity="0.35" stroke-width="2.5"') +
  rect(cx + 2, 28, 12, 10, '#fff', 3, 'fill-opacity="0.35" stroke-width="2.5"') +
  line(cx - 2, 32, cx + 2, 32, INK, 2.5);

const paperSheet = (x, y, angle) =>
  `<g transform="rotate(${angle} ${x + 8} ${y + 10})">` +
  rect(x, y, 16, 20, PAPER, 2, 'stroke-width="3"') +
  line(x + 4, y + 6, x + 12, y + 6, '#9aa7b5', 2) + line(x + 4, y + 11, x + 12, y + 11, '#9aa7b5', 2) +
  '</g>';

const coworkerNormal = () => person({
  shirt: '#e2553f', pants: '#7a2a22', shoes: '#4a1a16',
  hairBack: (cx) => [[-17, 19, 10], [-6, 13, 10], [8, 13, 10], [19, 23, 10], [-21, 34, 9], [22, 37, 8]]
    .map(([dx, y, r]) => circle(cx + dx, y, r, '#8c1f28')).join(''),
  hairFront: (cx) => path(`M${cx - 18} 24 q8 -13 18 -7 q10 -6 18 7 q-9 -5 -18 -3 q-9 -2 -18 3 z`, '#8c1f28') + glasses(cx),
  held: (cx) => paperSheet(cx - 36, 82, -18),
});

const coworkerFast = () => person({
  shirt: '#ff9f1c', pants: SLATE_DARK, shoes: '#f8fafc', lean: 7,
  hairFront: (cx) =>
    path(`M${cx - 20} 28 a20 20 0 0 1 40 0 q-20 -11 -40 0 z`, '#2a2a35') +
    line(cx - 19, 22, cx + 19, 22, '#ff5d5d', 5),                        // headband
  torso: (cx) => path(`M${cx - 6} 62 l5 8 l9 -12`, 'none', 'stroke="#fff" stroke-width="3.5"'),
  held: (cx) => rect(cx + 18, 78, 13, 13, '#ffe66d', 1, 'stroke-width="3"') + rect(cx + 24, 86, 13, 13, '#ff8fab', 1, 'stroke-width="3"'),
  extra: (cx) => [56, 70, 84].map(y => line(cx - 38, y, cx - 30, y, '#fff', 3, 'opacity="0.75"')).join(''),
});

const coworkerTank = () => person({
  width: 100, bodyHalf: 27, shirt: '#6b7280', pants: '#4b5563', shoes: '#1f2937', face: 'flat', mouth: 'flat',
  hairFront: (cx) =>
    path(`M${cx - 20} 30 q-2 -12 6 -18 q-2 8 0 16 z`, '#9ca3af') +
    path(`M${cx + 20} 30 q2 -12 -6 -18 q2 8 0 16 z`, '#9ca3af') + glasses(cx),
  torso: (cx) =>
    path(`M${cx - 9} 50 L${cx} 64 L${cx + 9} 50 z`, '#fff') +
    path(`M${cx - 3} 54 h6 l2 22 l-5 6 l-5 -6 z`, '#1f2937', 'stroke-width="2.5"') +
    line(cx - 9, 50, cx - 16, 70, INK, 3) + line(cx + 9, 50, cx + 16, 70, INK, 3),
  held: (cx) =>
    rect(cx + 24, 74, 18, 24, '#1f2937', 3, 'stroke-width="3"') + flat(cx + 27, 77, 12, 6, '#4ade80', 1) +
    [0, 1].map(r => [0, 1, 2].map(c => dot(cx + 29 + c * 4, 88 + r * 5, 1.4, '#9ca3af')).join('')).join(''),
});

const coworkerSwarm = () => person({
  bodyHalf: 15, shirt: '#34d399', pants: SLATE, shoes: '#f8fafc', face: 'worried', mouth: 'open', eye: 3.4,
  hairFront: (cx) =>
    path(`M${cx - 20} 26 a20 20 0 0 1 40 0 z`, '#16a34a') +               // cap
    rect(cx - 6, 22, 30, 7, '#15803d', 3),
  torso: (cx) =>
    path(`M${cx - 8} 50 L${cx} 68 L${cx + 8} 50`, 'none', 'stroke="#fbbf24" stroke-width="3"') +   // lanyard
    rect(cx - 6, 66, 12, 14, '#fff', 2, 'stroke-width="2.5"') + flat(cx - 3, 69, 6, 4, '#60a5fa'),
  extra: (cx) => dot(cx - 6, 32, 1.1, '#fff') + dot(cx + 8, 32, 1.1, '#fff'),
});

const coworkerBoss = () => person({
  width: 100, bodyHalf: 27, skin: '#eaa98a', shirt: '#8b1e2d', pants: '#6e1623', shoes: '#151515',
  hairFront: (cx) => path(`M${cx - 20} 28 q-2 -22 20 -22 q22 0 20 22 q-6 -12 -20 -11 q-14 -1 -20 11 z`, '#1f1a17'),
  torso: (cx) =>
    path(`M${cx - 9} 50 L${cx} 64 L${cx + 9} 50 z`, '#fff') +
    path(`M${cx - 3} 54 h6 l2 22 l-5 6 l-5 -6 z`, GOLD, 'stroke-width="2.5"') +
    line(cx - 9, 50, cx - 16, 72, INK, 3) + line(cx + 9, 50, cx + 16, 72, INK, 3),
  held: (cx) =>
    rect(cx - 46, 86, 26, 20, '#5e3820', 3) + rect(cx - 39, 80, 12, 8, 'none', 3, 'stroke-width="3"') +
    flat(cx - 36, 93, 6, 5, GOLD, 1),
  extra: (cx) =>
    line(cx - 13, 22, cx - 4, 27, INK, 4.5) + line(cx + 13, 22, cx + 4, 27, INK, 4.5) +   // heavier brows
    rect(cx + 5, 41, 14, 5, '#6b4a2f', 2, 'stroke-width="2.5"') + dot(cx + 20, 43.5, 2.2, '#ff9f1c'),  // cigar
});

// Марья Ивановна, главный бухгалтер: bouffant, glasses, cardigan, an armful of folders
const coworkerMaria = () => person({
  width: 100, bodyHalf: 24, shirt: CARDIGAN, pants: '#6d597a', shoes: '#355070', face: 'angry', mouth: 'flat',
  hairBack: (cx) => `<ellipse cx="${cx}" cy="21" rx="27" ry="19" fill="${PERM}"/>`,
  hairFront: (cx) =>
    path(`M${cx - 19} 27 q3 -15 19 -15 q16 0 19 15 q-9 -8 -19 -7 q-10 -1 -19 7 z`, PERM) + glasses(cx),
  torso: (cx) => [-8, -3, 2, 7].map((dx, i) => dot(cx + dx + 0.5, 54 + (i === 1 || i === 2 ? 3 : 0), 2, '#f4f1e6')).join(''),
  held: (cx) =>
    rect(cx - 22, 82, 44, 9, '#e9c46a', 2, 'stroke-width="3"') +
    rect(cx - 20, 74, 40, 9, PAPER, 2, 'stroke-width="3"') +
    rect(cx - 23, 66, 46, 9, '#8ecae6', 2, 'stroke-width="3"') +
    flat(cx - 17, 69, 14, 3, '#fff'),
  extra: (cx) => line(cx - 4, 42, cx + 4, 42, '#c0392b', 3.5),
});

const coworkerRemote = () => person({
  shirt: '#8b5cf6', pants: '#c4b5fd', shoes: '#f472b6', face: 'flat', mouth: 'flat',
  hairBack: (cx) => path(`M${cx - 22} 30 a22 24 0 0 1 44 0`, 'none', 'stroke-width="9"') +
    path(`M${cx - 22} 30 a22 24 0 0 1 44 0`, 'none', 'stroke="#4c1d95" stroke-width="4"'),   // headphone band
  hairFront: (cx) =>
    path(`M${cx - 20} 28 q-1 -20 20 -20 q21 0 20 20 q-5 -9 -11 -7 q-5 -5 -11 0 q-8 -6 -18 7 z`, '#5b3a24') +
    rect(cx - 27, 24, 9, 16, '#4c1d95', 4) + rect(cx + 18, 24, 9, 16, '#4c1d95', 4),
  torso: (cx) =>
    line(cx - 4, 52, cx - 4, 64, '#ddd6fe', 2.5) + line(cx + 4, 52, cx + 4, 64, '#ddd6fe', 2.5) +
    [92, 102, 112].map(y => line(cx - 12, y, cx - 4, y, '#a78bfa', 2.5) + line(cx + 4, y, cx + 12, y, '#a78bfa', 2.5)).join(''),
  held: (cx) => rect(cx + 14, 70, 26, 18, '#94a3b8', 3, 'transform="rotate(-12 ' + (cx + 27) + ' 79)"') +
    dot(cx + 27, 79, 3, '#e2e8f0'),
});

// ─── Output ─────────────────────────────────────────────────────────────
const sprites = {
  'tower-cooler': cooler, 'tower-router': router, 'tower-docs': docs,
  'tower-coffee': coffee, 'tower-aircon': aircon, 'tower-partner': partner,
  'furniture-cabinet': cabinet, 'furniture-drawer': drawer, 'furniture-sofa': sofa,
  'desk': desk, 'door': door, 'door-open': doorOpen, 'avatar-petya': avatarPetya,
  'avatar-vasya': avatarVasya, 'avatar-maria': avatarMaria, 'coworker-maria': coworkerMaria,
  'coworker': coworkerNormal, 'coworker-fast': coworkerFast, 'coworker-tank': coworkerTank,
  'coworker-swarm': coworkerSwarm, 'coworker-boss': coworkerBoss, 'coworker-remote': coworkerRemote,
};

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of Object.entries(sprites)) {
  writeFileSync(join(OUT, `${name}.svg`), draw());
}
console.log(`Wrote ${Object.keys(sprites).length} sprites to ${OUT}`);
