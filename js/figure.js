/* Yoga Set Maker – figure renderer (original artwork, generated as SVG).
   Each pose is a set of absolute segment angles in degrees: 0 = up, 90 = forward (right), 180 = down, 270 = back (left).
   One body, one line style, one palette for every pose, so all illustrations match.
   Limb spec: [upper, lower, (end), (scaleUpper)] or {ik:'l1.2'|[x,y], off:[x,y], bend:1|-1} to reach a point. */
(function (root) {
  'use strict';
  const LEN = { torso: 30, neck: 3.5, head: 6.4, uarm: 15, farm: 14, thigh: 21, shin: 20.5, foot: 6.5 };
  const W = { torso: 12.5, leg: 8.2, arm: 6.2, head: 6.6, halo: 3.2 };
  const rad = (d) => d * Math.PI / 180;
  const dir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];
  const add = (p, a, l) => { const d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
  const ang = (p, q) => Math.atan2(q[0] - p[0], -(q[1] - p[1])) * 180 / Math.PI;
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const r1 = (n) => Math.round(n * 10) / 10;

  function ik(a, b, L1, L2, bend) {
    let d = dist(a, b); const base = ang(a, b);
    d = Math.min(d, L1 + L2 - 0.01); d = Math.max(d, Math.abs(L1 - L2) + 0.01);
    const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
    const e = add(a, base + A * (bend || 1), L1);
    return [a, e, add(e, ang(e, b), L2)];
  }

  function build(P) {
    const front = P.v === 'f' || P.v === 'top';
    const t = P.t ?? 0, h = P.h ?? t;
    const H = [0, 0];
    const S = add(H, t, LEN.torso * (P.ts || 1));
    const sw = front ? 7.2 : 0, hw = front ? 4.6 : 0;
    const S1 = add(S, t + 90, sw), S2 = add(S, t - 90, sw);
    const H1 = add(H, t + 90, hw), H2 = add(H, t - 90, hw);
    const N = add(S, h, LEN.neck);
    const C = add(N, h, LEN.head);
    const B = { front, t, h, H, S, S1, S2, H1, H2, N, C };
    const target = (spec) => {
      let p;
      if (Array.isArray(spec.ik)) p = [spec.ik[0], spec.ik[1]];
      else { const [k, i] = spec.ik.split('.'); p = (i == null ? B[k] : B[k][+i]).slice(); }
      if (spec.off) { p[0] += spec.off[0]; p[1] += spec.off[1]; }
      return p;
    };
    const leg = (hp, l) => {
      if (!l) return null;
      let k, an, fa;
      if (!Array.isArray(l)) { const c = ik(hp, target(l), LEN.thigh, LEN.shin, l.bend); k = c[1]; an = c[2]; fa = l.foot ?? (ang(k, an) - 90); }
      else { k = add(hp, l[0], LEN.thigh * (l[3] || 1)); an = add(k, l[1], LEN.shin * (l[4] || 1)); fa = l[2]; }
      if (fa == null) fa = front ? l[1] : l[1] - 90;
      const fl = front && (Array.isArray(l) && l[2] == null) ? 2.5 : LEN.foot;
      return [hp, k, an, add(an, fa, fl)];
    };
    const arm = (s, a) => {
      if (!a) return null;
      if (!Array.isArray(a)) return ik(s, target(a), LEN.uarm, LEN.farm, a.bend);
      const e = add(s, a[0], LEN.uarm * (a[3] || 1)); return [s, e, add(e, a[1], LEN.farm * (a[2] || 1))];
    };
    B.l1 = leg(H1, P.l1); B.l2 = leg(H2, P.l2);
    B.a1 = arm(S1, P.a1); B.a2 = arm(S2, P.a2);
    return B;
  }

  function uniquePts(B) {
    const set = new Set([B.H, B.S, B.S1, B.S2, B.H1, B.H2, B.N, B.C]);
    ['a1', 'a2', 'l1', 'l2'].forEach((k) => B[k] && B[k].forEach((p) => set.add(p)));
    return [...set];
  }
  function transform(B, fn) { uniquePts(B).forEach((p) => { const q = fn(p); p[0] = q[0]; p[1] = q[1]; }); }

  /* opts: {size, mirror, cls, colors:{fig, far, mat, prop, halo}} */
  function svg(P, opts = {}) {
    if (!P) return '';
    const B = build(P);
    const TOP = P.v === 'top';
    if (P.rot) {
      const c = Math.cos(rad(P.rot)), s = Math.sin(rad(P.rot));
      transform(B, (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
      B.t += P.rot; B.h += P.rot;
    }
    const VW = 132, VH = 120, FLOOR = 108;
    const bounds = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of uniquePts(B)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      x0 = Math.min(x0, B.C[0] - W.head); x1 = Math.max(x1, B.C[0] + W.head); y0 = Math.min(y0, B.C[1] - W.head - 3); y1 = Math.max(y1, B.C[1] + W.head - 1);
      return { x0, x1, y0, y1 };
    };
    let bb = bounds();
    const availH = TOP ? VH - 30 : FLOOR - 9, availW = VW - 18;
    const k = Math.min(1, availH / (bb.y1 - bb.y0), availW / (bb.x1 - bb.x0));
    let sc = 1;
    if (k < 1) { sc = k; transform(B, (p) => [p[0] * k, p[1] * k]); bb = bounds(); }
    const pad = P.lift ?? 3.4;
    const dx = VW / 2 - (bb.x0 + bb.x1) / 2 + (P.dx || 0);
    const dy = TOP ? VH / 2 - (bb.y0 + bb.y1) / 2 : FLOOR - pad * sc - bb.y1 + (P.dy || 0);
    transform(B, (p) => [p[0] + dx, p[1] + dy]);
    const ws = (w) => r1(w * sc);
    const T = (p) => [r1(p[0]), r1(p[1])];
    const line = (arr) => 'M' + arr.map((p) => T(p).join(',')).join(' L');
    const col = Object.assign({ fig: 'var(--fig,#8b782e)', far: 'var(--fig-far,#d2bf94)', mat: 'var(--mat,#eadfd2)', prop: 'var(--prop,#b9a993)', halo: 'var(--halo,#fff)' }, opts.colors || {});
    const parts = [];
    if (TOP) parts.push(`<rect x="9" y="${r1(VH / 2 - 25)}" width="${VW - 18}" height="50" rx="7" fill="${col.mat}" opacity=".75"/>`);
    else parts.push(`<rect x="8" y="${FLOOR}" width="${VW - 16}" height="4.5" rx="2.25" fill="${col.mat}"/>`);
    const st = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${ws(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const part = (d, w, c, halo = true) => (halo ? st(d, w + W.halo * 2, col.halo) : '') + st(d, w, c);
    // props behind the body
    if (P.prop === 'chair') {
      const hx = B.H[0], hy = B.H[1] + 5.5 * sc;
      if (B.front) {
        parts.push(`<g fill="none" stroke="${col.prop}" stroke-width="3.2" stroke-linecap="round"><path d="M${r1(hx - 17)},${r1(hy)} L${r1(hx + 17)},${r1(hy)} M${r1(hx - 15)},${r1(hy)} L${r1(hx - 16)},${FLOOR} M${r1(hx + 15)},${r1(hy)} L${r1(hx + 16)},${FLOOR} M${r1(hx - 14)},${r1(hy)} L${r1(hx - 14)},${r1(hy - 30)} L${r1(hx + 14)},${r1(hy - 30)} L${r1(hx + 14)},${r1(hy)}"/></g>`);
      } else {
        const x0 = hx - 13, x1 = hx + 12, back = P.chairBack ?? -1, bx = back < 0 ? x0 : x1;
        parts.push(`<g fill="none" stroke="${col.prop}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M${r1(x0)},${r1(hy)} L${r1(x1)},${r1(hy)} M${r1(x0 + 2)},${r1(hy)} L${r1(x0 + 1)},${FLOOR} M${r1(x1 - 2)},${r1(hy)} L${r1(x1 - 1)},${FLOOR} M${r1(bx)},${r1(hy)} L${r1(bx + (back < 0 ? -2 : 2))},${r1(hy - 27)}"/></g>`);
      }
    }
    if (P.prop === 'wall' && B.l1) parts.push(`<rect x="${r1(Math.max(B.l1[3][0], B.l1[2][0]) + 6)}" y="6" width="5" height="${FLOOR - 4}" rx="2" fill="${col.prop}" opacity=".55"/>`);
    if (P.prop === 'bolster') { const hp = T(B.H); parts.push(`<rect x="${r1(hp[0] - 6)}" y="${r1(FLOOR - 9)}" width="36" height="9" rx="4.5" fill="${col.prop}"/>`); }
    if (P.prop === 'block' && B.a1) { const w = T(B.a1[2]); parts.push(`<rect x="${r1(w[0] - 7)}" y="${r1(w[1] + 2.5)}" width="14" height="${r1(Math.max(4, FLOOR - w[1] - 2.5))}" rx="2" fill="${col.prop}"/>`); }
    const farC = B.front || P.farDark ? col.fig : col.far;
    const farHalo = B.front || !!P.farDark;
    const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    // halo starts halfway along the upper segment so joints stay solid
    const limb = (arr, w, c, halo = true) => (halo ? st(line([lerp(arr[0], arr[1], 0.55), ...arr.slice(1)]), w + W.halo * 2, col.halo) : '') + st(line(arr), w, c);
    let torso;
    if (B.front) {
      const d = `M${T(B.H1)} L${T(B.S1)} L${T(B.S2)} L${T(B.H2)} Z`;
      torso = `<path d="${d}" fill="${col.fig}" stroke="${col.halo}" stroke-width="${ws(5 + W.halo * 2)}" stroke-linejoin="round"/><path d="${d}" fill="${col.fig}" stroke="${col.fig}" stroke-width="${ws(5)}" stroke-linejoin="round"/>`;
    } else {
      let d = `M${T(B.H)} L${T(B.S)}`;
      if (P.c) { const mid = [(B.H[0] + B.S[0]) / 2, (B.H[1] + B.S[1]) / 2]; const cp = add(mid, B.t - 90, P.c * 2 * sc); d = `M${T(B.H)} Q${T(cp)} ${T(B.S)}`; }
      torso = part(d, W.torso, col.fig);
    }
    const bunA = B.front ? B.h : B.h - 62;
    const bun = add(B.C, bunA, (W.head + 1.2) * sc);
    const C = T(B.C), bT = T(bun);
    const head = st(line([B.S, B.N]), 5.2, col.fig) + `<circle cx="${C[0]}" cy="${C[1]}" r="${ws(W.head + W.halo)}" fill="${col.halo}"/>` +
      (P.nobun ? '' : `<circle cx="${bT[0]}" cy="${bT[1]}" r="${ws(2.8)}" fill="${col.fig}"/>`) + `<circle cx="${C[0]}" cy="${C[1]}" r="${ws(W.head)}" fill="${col.fig}"/>`;
    const same = (p, q) => p && q && p.every((pt, i) => dist(pt, q[i]) < 4.5);
    if (!B.front && same(B.a1, B.a2)) B.a2 = null;
    if (!B.front && same(B.l1, B.l2)) B.l2 = null;
    const L1 = B.l1 ? limb(B.l1, W.leg, col.fig) : '', L2 = B.l2 ? limb(B.l2, W.leg, farC, farHalo) : '';
    const A1 = B.a1 ? limb(B.a1, W.arm, col.fig) : '', A2 = B.a2 ? limb(B.a2, W.arm, farC, farHalo || P.a2front) : '';
    if (B.front && P.armsBehind) parts.push(A2, A1, torso, L2, L1, head);
    else if (B.front && P.a2behind) parts.push(A2, torso, L2, L1, head, A1);
    else if (B.front && P.headLast) parts.push(torso, L2, L1, A2, A1, head);
    else if (B.front) parts.push(torso, P.headFirst ? head : '', L2, L1, P.headFirst ? '' : head, A2, A1);
    else if (P.legsBack && P.headLast) parts.push(L2, A2, L1, torso, A1, head);
    else if (P.legsBack) parts.push(L2, P.a2front ? '' : A2, L1, torso, head, P.a2front ? A2 : '', A1);
    else parts.push(L2, P.a2front ? '' : A2, torso, head, L1, P.a2front ? A2 : '', A1);
    if (P.prop === 'strap' && B.a1 && B.l1) parts.push(`<path d="M${T(B.a1[2])} L${T(B.l1[3])}" stroke="${col.prop}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    const mir = opts.mirror ? ` transform="translate(${VW},0) scale(-1,1)"` : '';
    const size = opts.size ? ` width="${opts.size}" height="${r1(opts.size * VH / VW)}"` : '';
    // CSS-variabelen werken alleen via style, niet als SVG-attribuut
    const body = parts.join('').replace(/<(path|circle|rect)([^>]*?)\/>/g, (m, tag, attrs) => {
      let css = '';
      attrs = attrs.replace(/\s(fill|stroke)="(var\([^"]*\))"/g, (mm, k, v) => { css += `${k}:${v};`; return ''; });
      return css ? `<${tag}${attrs} style="${css}"/>` : m;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}"${size} class="${opts.cls || 'fig'}" aria-hidden="true"><g${mir}>${body}</g></svg>`;
  }

  const api = { svg, build, LEN };
  if (typeof module !== 'undefined') module.exports = api; else root.Figure = api;
})(typeof window !== 'undefined' ? window : globalThis);
