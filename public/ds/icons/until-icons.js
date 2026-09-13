// UNTIL Design System — service icons.
// 16 line icons on a 24x24 grid, 1.5 stroke, round caps and joins.
// They inherit currentColor, so colour them with --accent (or --faint when a
// service is not covered). Never fill them.

export const UNTIL_ICONS = {
  physio: "<path d=\"M3 17h18M6 17v3M18 17v3\"/><path d=\"M3 17v-3h10l4 3\"/><circle cx=\"7.5\" cy=\"10\" r=\"2.2\"/>",
  osteo: "<path d=\"M9 21V10.5a1.5 1.5 0 0 1 3 0V13\"/><path d=\"M12 13V8.5a1.5 1.5 0 0 1 3 0V13\"/><path d=\"M15 13v-1.5a1.5 1.5 0 0 1 3 0V17a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-3.5\"/>",
  chiro: "<path d=\"M10.5 2.5c0 3 3 3 3 6s-3 3-3 6 3 3 3 6\"/><path d=\"M8 5.5h2.6M13.4 11.5H16M8 17.5h2.6\"/>",
  massage: "<path d=\"M2 18.5c4.5-6.5 15.5-6.5 20 0\"/><circle cx=\"9\" cy=\"11\" r=\"2.3\"/><circle cx=\"15\" cy=\"11\" r=\"2.3\"/>",
  acu: "<path d=\"M3 21l9-9\"/><path d=\"M14.5 9.5L18 6\"/><path d=\"M17 3.5l4 4-2.2 2.2-4-4z\"/>",
  pod: "<path d=\"M8.5 21.5c-2.2 0-3.8-1.7-3.8-4.2 0-3 1.6-4.3 1.6-7.3A5 5 0 0 1 11.3 5c2.6 0 4.2 2 4.2 4.6 0 3-1.6 4.5-1.6 7.7 0 2.5-1.6 4.2-3.8 4.2z\"/><circle cx=\"17.5\" cy=\"6.5\" r=\"1.4\"/><circle cx=\"19.6\" cy=\"10\" r=\"1.2\"/>",
  nutri: "<path d=\"M12 8.2c-1.1-1.9-4-2.3-5.4-.8C5 8.9 5 12.3 6.4 15.2c1 2 2.4 4.8 3.7 4.8.9 0 1.1-.6 1.9-.6s1 .6 1.9.6c1.3 0 2.7-2.8 3.7-4.8 1.4-2.9 1.4-6.3 0-7.8-1.4-1.5-4.3-1.1-5.6.8z\"/><path d=\"M12 8.2V5.4c0-1.3 1.1-2.4 2.6-2.4\"/>",
  mind: "<path d=\"M15.2 21v-2.6a5.6 5.6 0 0 0 3-5A7.6 7.6 0 1 0 6 19.8V21\"/><circle cx=\"11.6\" cy=\"10.4\" r=\"2.5\"/>",
  venus: "<circle cx=\"12\" cy=\"8.6\" r=\"5\"/><path d=\"M12 13.6V21M8.6 18h6.8\"/>",
  tooth: "<path d=\"M12 4.4C10.2 3 7.4 2.5 6 4S4.4 8.4 5.3 12.2C6.2 16 6.6 20.5 8.2 20.5s1.4-5.2 3.8-5.2 2.2 5.2 3.8 5.2 2-4.5 2.9-8.3c.9-3.8 1.3-6.7-.1-8.2s-4.2-1-6 .4z\"/>",
  ear: "<path d=\"M7 9.2a5 5 0 0 1 10 0c0 2.6-2 3.4-3.1 4.7-.9 1.1-.5 2.6-2 3.6-1.1.7-2.5.5-3.2-.6\"/><path d=\"M10.3 9.6a1.9 1.9 0 0 1 3.7.5c0 1.5-1.4 1.9-1.9 3\"/><path d=\"M5.5 20.5c-1.4-1.7-2-3.7-2-6\"/>",
  eye: "<path d=\"M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3.1\"/>",
  steth: "<path d=\"M6 3v5.5a4.2 4.2 0 0 0 8.4 0V3\"/><path d=\"M4.2 3h3.4M12.8 3h3.4\"/><path d=\"M10.2 12.7v2.1a5.2 5.2 0 0 0 5.2 5.2h.2\"/><circle cx=\"18.2\" cy=\"17.8\" r=\"2.6\"/>",
  clip: "<rect x=\"5\" y=\"4.2\" width=\"14\" height=\"17\" rx=\"1.6\"/><path d=\"M9 4.2V2.9h6v1.3\"/><path d=\"M8.6 12.6l2.6 2.6 4.6-4.9\"/>",
  derm: "<circle cx=\"10.4\" cy=\"10.4\" r=\"6.6\"/><path d=\"M15.4 15.4L21 21\"/><circle cx=\"8.6\" cy=\"8.8\" r=\".9\"/><circle cx=\"12\" cy=\"10.8\" r=\".9\"/><circle cx=\"9.4\" cy=\"12.8\" r=\".9\"/>",
  bell: "<path d=\"M3 9v6M6.2 6.5v11M17.8 6.5v11M21 9v6M6.2 12h11.6\"/>",
};

export const ICON_TITLES = {
  physio: "Physiotherapy",
  osteo: "Osteopathy",
  chiro: "Chiropractic",
  massage: "Sports and remedial massage",
  acu: "Acupuncture",
  pod: "Podiatry and chiropody",
  nutri: "Nutrition and dietetics",
  mind: "Mental health and talking therapy",
  venus: "Women's health and menopause",
  tooth: "Dentistry",
  ear: "Audiology and hearing",
  eye: "Optical and eye health",
  steth: "Private GP",
  clip: "Health screening",
  derm: "Dermatology and skin",
  bell: "Rehab and strength",
};

export function icon(key, {title} = {}) {
  const body = UNTIL_ICONS[key];
  if (!body) throw new Error(`Unknown UNTIL icon: ${key}`);
  const label = title ?? ICON_TITLES[key];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"`
    + ` stroke-linecap="round" stroke-linejoin="round" role="img"><title>${label}</title>`
    + `${body}</svg>`;
}
