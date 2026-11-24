(() => {
  const D = window.KEIBA_DATA;
  const $view = document.getElementById("view");
  const TYPE_COLOR = { 日: "var(--jp)", 米: "var(--us)", 欧: "var(--eu)" };
  const TYPE_NAME = { 日: "日本型", 米: "米国型", 欧: "欧州型" };

  // ---------- state ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("turfnote:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("turfnote:" + k, JSON.stringify(v)); } catch {} },
  };
  const state = Object.assign({ route: "course", venue: "東京", surface: "芝", label: "芝1600", skin: "midnight", zukan: "all" }, store.get("state", {}));
  const save = () => store.set("state", state);

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SIRE = Object.fromEntries((D.sires || []).map((s) => [s.name, s]));
  const reEsc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sireNames = [...new Set([...Object.keys(D.sireType), ...Object.keys(SIRE)])].sort((a, b) => b.length - a.length);
  const sireRe = new RegExp("(" + sireNames.map(reEsc).join("|") + ")", "g");
  // 名前はそのまま入れる（%で符号化すると、数字の%を飾る処理とぶつかる）
  const sireHref = (n) => "#sire/" + n;
  const sireTag = (m) => SIRE[m]
    ? `<a class="sire t-${D.sireType[m]}" href="${sireHref(m)}">${m}</a>`
    : `<span class="sire t-${D.sireType[m] || ""}">${m}</span>`;
  // 図鑑・レッスンの中だけ、型や系統の言葉をレッスンへのリンクにする
  const TERMS = [
    [/(日本型|米国型|欧州型)/g, 2],
    [/(ディープ系|[PTDL]サンデー系)/g, 3],
    [/(根幹距離|非根幹距離)/g, 4],
  ];
  const rich = (s, opt = {}) => {
    let h = esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    if (opt.terms) TERMS.forEach(([re, n]) => { h = h.replace(re, `<a class="term" href="#lesson/${n}">$1</a>`); });
    h = h.replace(/\[\[(\d+)\]\]/g, (_, n) => { const l = D.lessons.find((x) => x.n === +n); return `<a class="term" href="#lesson/${n}">レッスン${n}${l ? "「" + esc(l.title) + "」" : ""}</a>`; });
    return h
      .replace(sireRe, sireTag)
      .replace(/(\d+(?:\.\d+)?%)/g, '<span class="num">$1</span>');
  };
  const ckey = (c) => `${c.venue}|${c.label}`;
  // コース名。内回りと外回りがある競馬場の芝は「内」「外」を必ず付ける（例：京都 芝1400内／京都 芝1400外）
  const cname = (k) => {
    const [v, l] = k.split("|");
    const two = ["中山", "阪神", "京都", "新潟"].includes(v) && l.startsWith("芝") && !l.endsWith("外") && !(v === "新潟" && l === "芝1000");
    return `${v} ${l}${two ? "内" : ""}`;
  };
  // 「よく来る」（複勝率＝結果）と「妙味」（過去の回収率）を分けて判定する
  const isGood = (r) => r.n >= 20 && r.p >= r.avg * 1.2;
  const isValue = (r) => r.n >= 20 && r.p >= r.avg * 0.85 && (r.f >= 100 || (r.t >= 120 && r.f >= 90));
  const isWeak = (r) => r.n >= 20 && r.p <= r.avg * 0.75;
  const labels = (r) => [
    isGood(r) ? '<span class="lab good">よく来る</span>' : "",
    isValue(r) ? '<span class="lab value">妙味</span>' : "",
    isWeak(r) ? '<span class="lab weak">来ていない</span>' : "",
  ].join("");
  const factLine = (r) => `<span class="num">${r.n}</span>走・複勝率 <b class="num">${r.p}%</b><span class="muted">（平均${r.avg}%）</span>・単回<span class="num">${r.t}</span>／複回<span class="num">${r.f}</span>`;
  const rowFor = (name, k) => (SIRE[name]?.rows || []).find((r) => r.k === k);
  const coursesOf = (v, s) => D.courses.filter((c) => c.venue === v && c.surface === s);
  const find = () => D.courses.find((c) => c.venue === state.venue && c.label === state.label);
  const venueInfo = (v) => D.venues.find((x) => x.name === v);
  const pct = (s) => { const m = String(s || "").match(/(\d+)%/); return m ? +m[1] : null; };

  function ensureValid() {
    let list = coursesOf(state.venue, state.surface);
    if (!list.length) { state.surface = state.surface === "芝" ? "ダート" : "芝"; list = coursesOf(state.venue, state.surface); }
    if (!list.find((c) => c.label === state.label)) state.label = list[0]?.label;
  }

  // 芝に内回りと外回りの2つのコースがある競馬場。ここでは「外」と付いていない芝は内回り
  const TWO_LOOPS = ["中山", "阪神", "京都", "新潟"];
  const loopOf = (c) => {
    if (c.surface !== "芝") return "";
    if (c.venue === "新潟" && c.label === "芝1000") return "直線";
    if (!TWO_LOOPS.includes(c.venue)) return "";
    return c.label.endsWith("外") ? "外回り" : "内回り";
  };
  const labelParts = (c) => ({ surf: c.surface === "芝" ? "芝" : "ダート", dist: c.dist, tag: loopOf(c) });

  // ---------- course view ----------
  function renderCourse() {
    ensureValid();
    const v = venueInfo(state.venue);
    const c = find();
    const list = coursesOf(state.venue, state.surface);
    const lp = labelParts(c);

    const venues = D.venues.map((x) => `
      <button class="venue ${x.name === state.venue ? "is-active" : ""}" data-venue="${x.name}">
        <span class="v-jp">${x.name}</span><span class="v-en">${x.en}</span>
      </button>`).join("");
    const dists = list.map((x) => {
      const lp2 = loopOf(x);
      const t = lp2 === "外回り" ? '<small class="lo">外</small>' : lp2 === "内回り" ? '<small class="li">内</small>' : lp2 === "直線" ? "<small>直</small>" : "";
      return `<button class="dist ${x.label === state.label ? "is-active" : ""}" data-label="${x.label}">${x.dist}${t}</button>`;
    }).join("");

    const startPill = c.surface === "ダート"
      ? (c.turfStart ? `<span class="pill pill-turf">芝スタート</span>` : `<span class="pill">ダートスタート</span>`)
      : "";
    const pills = [
      lp.tag ? `<span class="pill pill-loop">${lp.tag}</span>` : "",
      startPill,
      `<span class="pill">${v.turn}</span>`,
    ].join("");

    $view.innerHTML = `
      <section class="picker">
        <p class="label-sm">Racecourse</p>
        <div class="scroller">${venues}</div>
        <div class="row2">
          <div class="seg">
            <button data-s="芝" class="${state.surface === "芝" ? "is-active" : ""}">芝</button>
            <button data-s="ダート" class="${state.surface === "ダート" ? "is-active" : ""}">ダート</button>
          </div>
          <div class="scroller dists">${dists}</div>
        </div>
      </section>

      <article class="fade" id="course">
        <section class="hero">
          <img src="img/${v.slug}-3d.jpg" alt="${v.name}競馬場の立体図（JRA）">
          <div class="hero-in">
            <div class="hero-en">${v.en} RACECOURSE</div>
            <div class="hero-title">
              <span class="surf ${lp.surf === "ダート" ? "dirt" : ""}">${lp.surf}</span>
              <span class="d">${lp.dist}<small>m</small></span>
            </div>
            <div class="pills">${pills}</div>
          </div>
        </section>

        ${renderMap(v, c)}
        ${renderBuyAvoid(c)}
        ${renderPoints(c)}
        ${renderSires(c)}
        ${renderTypes(c)}
        ${renderRace(c)}
        ${renderPeople(c)}
        ${renderRain(c)}
        ${renderTrack(v, c)}
        <p class="foot">血統・枠・人気・騎手・母父：スマート出馬表 5年集計（2021.11〜2026.11）<br>脚質：うまめし（2023年〜）／コース図：JRA<br>自分用のメモ。数字は過去の集計で、走数が少ないものは参考程度。</p>
      </article>`;

    $view.querySelectorAll("[data-venue]").forEach((b) => b.onclick = () => { state.venue = b.dataset.venue; state.label = null; save(); renderCourse(); });
    $view.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { state.surface = b.dataset.s; state.label = null; save(); renderCourse(); });
    $view.querySelectorAll("[data-label]").forEach((b) => b.onclick = () => { state.label = b.dataset.label; save(); renderCourse(); });
    const act = $view.querySelector(".venue.is-active"); if (act) act.scrollIntoView({ inline: "center", block: "nearest" });
    const actd = $view.querySelector(".dist.is-active"); if (actd) actd.scrollIntoView({ inline: "center", block: "nearest" });
  }

  // ---------- コースの構図（スタート→ゴールの模式図） ----------
  // 1周の長さと最後の直線の長さ（m、JRAのコース紹介より。芝はAコース）
  const LOOPS = {
    東京: { 芝: [2083.1, 525.9], ダ: [1899, 501.6] },
    中山: { 芝内: [1667.1, 310], 芝外: [1839.7, 310], ダ: [1493, 308] },
    阪神: { 芝内: [1689, 356.5], 芝外: [2089, 473.6], ダ: [1517.6, 352.7] },
    京都: { 芝内: [1782.8, 328.4], 芝外: [1894.3, 403.7], ダ: [1607.6, 329.1] },
    中京: { 芝: [1705.9, 412.5], ダ: [1530, 410.7] },
    新潟: { 芝内: [1623, 358.7], 芝外: [2223, 658.7], ダ: [1472.5, 353.9] },
    札幌: { 芝: [1640.9, 266.1], ダ: [1487, 264.3] },
    函館: { 芝: [1626.6, 262.1], ダ: [1475.8, 260.3] },
    福島: { 芝: [1600, 292], ダ: [1444.6, 295.7] },
    小倉: { 芝: [1615.1, 293], ダ: [1445.4, 291.3] },
  };
  // ゴール前の坂（ゴールまでの残り距離のあたり）。京都は3コーナーの丘
  const SLOPE = { 東京: 400, 中山: 130, 阪神: 150, 中京: 340 };

  function renderMap(v, c) {
    const loop = loopOf(c);
    const k0 = c.surface === "芝" ? (loop === "外回り" ? "芝外" : loop === "内回り" ? "芝内" : "芝") : "ダ";
    const L0 = LOOPS[c.venue] && LOOPS[c.venue][k0];
    const left = v.turn === "左回り";
    const W = 340;
    let svg = "", lapNote = "";
    const accent = "var(--accent)";

    if (loop === "直線") {
      // 新潟芝1000：まっすぐ1本
      svg = `<svg viewBox="0 0 ${W} 90" class="cmap" role="img" aria-label="直線1000mの図">
        <rect x="20" y="30" width="300" height="26" rx="13" class="cm-track"/>
        <line x1="34" y1="43" x2="300" y2="43" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>
        <polygon points="300,35 314,43 300,51" fill="${accent}"/>
        <circle cx="34" cy="43" r="9" class="cm-start"/><text x="34" y="47" class="cm-s">S</text>
        <line x1="314" y1="24" x2="314" y2="62" class="cm-goal"/><text x="314" y="80" class="cm-lbl" text-anchor="end">ゴール</text>
        <text x="34" y="80" class="cm-lbl">スタート</text>
        <text x="170" y="22" class="cm-dim" text-anchor="middle">1000m まっすぐ。コーナーなし</text>
      </svg>`;
    } else if (L0) {
      const [L, H] = L0;
      const S = H * 1.25;                    // 直線の長さ（両側とも同じにして単純化）
      const r = (L - 2 * S) / (2 * Math.PI);  // コーナーの半径
      const k = 288 / (S + 2 * r);            // 1mあたりのpx
      const R = r * k, cy = 34 + R, cxL = 26 + R, cxR = cxL + S * k, xg = cxR - H * k;
      const a = S - H, half = Math.PI * r;
      const ent = { 1: a, 2: a + half / 2, 3: a + half + S, 4: a + half + S + half / 2 };
      const mx = (x) => (left ? W - x : x);
      const pt = (s0) => {
        let s = ((s0 % L) + L) % L, x, y;
        if (s < a) { x = xg - s * k; y = cy + R; }
        else if (s < a + half) { const t = Math.PI / 2 + (s - a) / r; x = cxL + R * Math.cos(t); y = cy + R * Math.sin(t); }
        else if (s < a + half + S) { x = cxL + (s - a - half) * k; y = cy - R; }
        else if (s < L - H) { const t = -Math.PI / 2 + (s - a - half - S) / r; x = cxR + R * Math.cos(t); y = cy + R * Math.sin(t); }
        else { x = cxR - (s - (L - H)) * k; y = cy + R; }
        return [mx(x), y];
      };
      // スタートの位置：「最初のコーナーまで◯m」が分かればそこから逆算。分からなければ距離から計算
      const D = c.dist;
      let sStart = ((-D % L) + L) % L;
      const cn = +((c.corner || "").match(/^(\d)コーナー/) || [])[1];
      const T = +(((c.toCorner || "").match(/(\d+)m/) || [])[1]);
      if (cn && T) sStart = (((ent[cn] - T) % L) + L) % L;
      const toGoal = (L - sStart) % L;
      const laps = Math.max(0, Math.round((D - toGoal) / L));
      const run = toGoal + laps * L;
      if (laps > 0) lapNote = `コースを${laps === 1 ? "1周" : laps + "周"}以上回る（スタートの前を一度通る）`;
      const path = [];
      for (let t = 0; t <= run; t += 8) path.push(pt(sStart + t));
      path.push(pt(L));
      const d = path.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
      const loopD = []; for (let s = 0; s <= L; s += 8) loopD.push(pt(s));
      const ld = loopD.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("") + "Z";
      // 進む向きの矢印
      const arrows = [0.3, 0.6, 0.85].map((f) => {
        const s = sStart + run * f, p = pt(s), q = pt(s + 6);
        const ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
        return `<polygon points="-5,-5 5,0 -5,5" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${ang.toFixed(0)})" class="cm-arrow"/>`;
      }).join("");
      // コーナーの番号（外側に置く）
      const cl = [1, 2, 3, 4].map((n) => {
        const s = ent[n] + half / 4;
        const p = pt(s);
        const cx = mx(n <= 2 ? cxL : cxR);
        const dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy) || 1;
        return `<text x="${(p[0] + (dx / len) * 13).toFixed(1)}" y="${(p[1] + (dy / len) * 13 + 4).toFixed(1)}" class="cm-cn${n === cn ? " on" : ""}">${n}</text>`;
      }).join("");
      const sp = pt(sStart), gp = pt(0);
      const goalY = cy + R;
      // 坂
      let slope = "";
      if (SLOPE[c.venue] && SLOPE[c.venue] < H) {
        const p = pt(L - SLOPE[c.venue]);
        slope = `<g transform="translate(${p[0].toFixed(1)} ${(goalY + 15).toFixed(1)})"><rect x="-13" y="-8" width="26" height="16" rx="8" class="cm-slope"/><text y="4" class="cm-st">坂</text></g>`;
      } else if (c.venue === "京都") {
        const p = pt(ent[3] + half / 4);
        slope = `<g transform="translate(${p[0].toFixed(1)} ${(p[1] - 20).toFixed(1)})"><rect x="-13" y="-8" width="26" height="16" rx="8" class="cm-slope"/><text y="4" class="cm-st">丘</text></g>`;
      }
      const hgt = Math.ceil(cy + R + 40);
      const startLblY = sp[1] < cy ? sp[1] - 14 : sp[1] + 24;
      svg = `<svg viewBox="0 0 ${W} ${hgt}" class="cmap" role="img" aria-label="スタートからゴールまでの模式図">
        <path d="${ld}" class="cm-track"/>
        <path d="${ld}" class="cm-rail"/>
        <path d="${d}" class="cm-run"/>
        ${arrows}
        ${cl}
        <line x1="${gp[0].toFixed(1)}" y1="${(goalY - 11).toFixed(1)}" x2="${gp[0].toFixed(1)}" y2="${(goalY + 11).toFixed(1)}" class="cm-goal"/>
        <text x="${gp[0].toFixed(1)}" y="${(goalY + 30).toFixed(1)}" class="cm-lbl" text-anchor="middle">ゴール</text>
        ${slope}
        <circle cx="${sp[0].toFixed(1)}" cy="${sp[1].toFixed(1)}" r="9" class="cm-start${c.turfStart ? " turf" : ""}"/>
        <text x="${sp[0].toFixed(1)}" y="${(sp[1] + 4).toFixed(1)}" class="cm-s">S</text>
        <text x="${sp[0].toFixed(1)}" y="${startLblY.toFixed(1)}" class="cm-lbl" text-anchor="middle">スタート</text>
        <text x="${W / 2}" y="${(cy + 4).toFixed(1)}" class="cm-mid" text-anchor="middle">${v.turn}${loop ? "・" + loop : ""}</text>
      </svg>`;
    } else return "";

    const lastStraight = L0 ? `${L0[1]}m` : "—";
    const T = (c.toCorner || "").replace(/\*/g, "");
    return `<section class="card cmapcard"><div class="card-h"><span class="ico" style="background:var(--accent-soft);color:var(--accent)">→</span><h2>スタートからゴールまで</h2><span class="en">Course map</span></div>
      ${svg}
      <div class="cm-steps">
        <div class="st"><span class="n">1</span><div><b>スタート</b>：${esc((c.start || "—").replace(/\*\*/g, ""))}${c.turfStart ? '<span class="lab good">芝からスタート</span>' : ""}</div></div>
        ${c.corner && !/なし/.test(c.corner) ? `<div class="st"><span class="n">2</span><div><b>最初のコーナー</b>：${esc(c.corner)}まで <b class="num">${esc(T || "—")}</b></div></div>` : ""}
        <div class="st"><span class="n">${c.corner && !/なし/.test(c.corner) ? 3 : 2}</span><div><b>最後の直線</b>：<b class="num">${lastStraight}</b>${SLOPE[c.venue] ? "。ゴール前に坂" : c.venue === "京都" ? "。3コーナーに丘（上って下る）" : "。平坦に近い"}</div></div>
        ${lapNote ? `<div class="st"><span class="n">!</span><div>${lapNote}</div></div>` : ""}
      </div>
      <p class="note">形は楕円に単純化した模式図（長さの比はだいたい）。スタートの位置は「最初のコーナーまでの距離」から逆算。</p>
    </section>`;
  }

  // 買い・消しの項目に出てくる種牡馬について、このコースの数字と理屈を1行ずつ添える
  function sireNotes(text, k, buy) {
    // 「母父〇〇」は母の父としての話なので、父としての数字は出さない
    const names = [...new Set(text.match(sireRe) || [])].filter((n) => SIRE[n] && !text.includes("母父" + n));
    return names.map((n) => {
      const s = SIRE[n];
      const r = rowFor(n, k);
      const fact = r ? `<div class="sn-l"><span class="tg f">数字</span><span>${labels(r)} ${factLine(r)}</span></div>` : "";
      const why = buy ? `<div class="sn-l"><span class="tg w">理屈</span><span>${esc(s.tagline)}</span></div>` : "";
      if (!fact && !why) return "";
      return `<div class="sn"><div class="sn-n">${sireTag(n)}<span class="sn-go">図鑑 ›</span></div>${fact}${why}</div>`;
    }).join("");
  }

  function renderBuyAvoid(c) {
    if (!c.buy && !c.avoid) return "";
    const k = ckey(c);
    const li = (arr, mk, buy) => (arr || []).map((x) => `<li><span class="mk">${mk}</span><div class="li-b"><span>${rich(x)}</span>${sireNotes(x, k, buy)}</div></li>`).join("") || `<li class="empty">特になし</li>`;
    return `
      <div class="bs">
        <section class="card buy"><div class="card-h"><span class="ico">◎</span><h2>買い</h2><span class="en">Buy</span></div><ul class="list">${li(c.buy, "✓", true)}</ul></section>
        <section class="card avoid"><div class="card-h"><span class="ico">✕</span><h2>消し</h2><span class="en">Fade</span></div><ul class="list">${li(c.avoid, "✕", false)}</ul></section>
      </div>
      ${legend()}`;
  }

  function legend() {
    return `<div class="legend">
      <div><span class="lab good">よく来る</span>複勝率がコース平均の1.2倍以上（結果）</div>
      <div><span class="lab value">妙味</span>人気のわりに来た（過去の回収率が高い）</div>
      <div class="muted">どちらも過去5年の集計で、<b>今日のオッズの妙味ではない</b>。人気になっていれば妙味は消えている。<a class="term" href="#lesson/8">レッスン8</a></div>
    </div>`;
  }

  // このコースで目立つ種牡馬（図鑑の50頭から）
  function renderSires(c) {
    const k = ckey(c);
    const list = Object.values(SIRE).map((s) => ({ s, r: rowFor(s.name, k) })).filter((x) => x.r && x.r.n >= 20);
    if (!list.length) return "";
    list.sort((a, b) => b.r.p - a.r.p);
    const avg = D.courseAvg[k];
    const rows = list.map(({ s, r }) => `
      <a class="srow" href="${sireHref(s.name)}">
        <span class="srow-n"><span class="sire t-${s.type}">${s.name}</span><span class="srow-l">${labels(r)}</span></span>
        <span class="srow-p num">${r.p}<small>%</small></span>
        <span class="srow-d">${r.n}走・単回${r.t}／複回${r.f}</span>
      </a>`).join("");
    return `<section class="card"><div class="card-h"><span class="ico" style="background:var(--eu-soft);color:var(--eu)">種</span><h2>このコースの種牡馬</h2><span class="en">Sires here</span></div>
      <p class="note" style="margin:0 0 8px">図鑑の種牡馬のうち、このコースで20走以上あるもの（複勝率の高い順）。コース平均は <b class="num">${avg}%</b>。タップで図鑑へ。</p>
      <div class="srows">${rows}</div></section>`;
  }

  function renderPoints(c) {
    if (!c.points) return "";
    const kinds = { "🧬": ["blood", "血統"], "🔢": ["waku", "枠"], "🏇": ["style", "脚質"], "💰": ["", "回収"] };
    const parts = c.points.split(/(?=🧬|🔢|🏇|💰)/u).map((s) => s.trim()).filter(Boolean);
    const items = parts.map((p) => {
      const e = [...p][0];
      const k = kinds[e];
      let body = k ? p.slice(e.length) : p;
      const star = body.includes("★");
      body = body.replace(/★+/g, "").trim();
      return `<div class="pt">${k ? `<span class="k ${k[0]}">${k[1]}</span>` : ""}<div>${star ? '<span class="star">★ </span>' : ""}${rich(body)}</div></div>`;
    }).join("");
    return `<section class="card"><div class="card-h"><span class="ico" style="background:var(--accent-soft);color:var(--accent)">!</span><h2>注目ポイント</h2><span class="en">Highlights</span></div><div class="points">${items}</div></section>`;
  }

  function renderTypes(c) {
    if (!c.types) return "";
    const r = c.types.rate;
    const max = Math.max(...Object.values(r), 1);
    const bars = ["日", "米", "欧"].filter((t) => r[t] != null).map((t) => `
      <div class="tbar ${c.types.best === t ? "best" : ""}">
        <span class="nm"><i class="dot" style="background:${TYPE_COLOR[t]}"></i>${TYPE_NAME[t]}</span>
        <div class="track"><div class="fill" style="width:${(r[t] / max) * 100}%;background:${TYPE_COLOR[t]}"></div></div>
        <span class="v">${r[t]}%</span>
      </div>`).join("");
    return `<section class="card"><div class="card-h"><span class="ico" style="background:var(--eu-soft);color:var(--eu)">父</span><h2>父の型と複勝率</h2><span class="en">Sire type</span></div>
      <div class="types">${bars}</div>
      <p class="note">5年・<span class="num">${c.types.runs.toLocaleString()}</span>走。日本型＝サンデー系（瞬発力）、米国型＝スピードの持続、欧州型＝スタミナと馬力。<a class="term" href="#lesson/2">レッスン2</a></p></section>`;
  }

  function renderRace(c) {
    const e = c.extra;
    if (!e) return "";
    const m = e.waku.match(/内(\d+)%・外(\d+)%/);
    const inn = m ? +m[1] : null, out = m ? +m[2] : null;
    const tag = e.waku.replace(/（.*$/, "").replace(/\*/g, "");
    const tagCls = /内有利|外有利/.test(tag) ? "good" : /やや/.test(tag) ? "mid" : "mid";
    const fav = pct(e.fav);
    const favTag = /堅い/.test(e.fav) ? '<span class="badge good">堅い</span>' : /荒れ/.test(e.fav) ? '<span class="badge warn">荒れ</span>' : "";
    const favNote = (e.fav.match(/人気薄の単回\d+%/) || [""])[0];
    const sm = e.style.match(/(\d+)%\s*\/\s*(\d+)%/);
    const lead = sm ? +sm[1] : null, late = sm ? +sm[2] : null;
    const styleTag = lead != null ? (late - lead >= 8 ? "末脚型が有利" : lead - late >= 4 ? "先行型が有利" : "差は小さい") : "";
    const tot = (inn || 0) + (out || 0) || 1;
    const startStat = c.surface === "ダート" ? `
        <div class="stat wide ${c.turfStart ? "turfstart" : ""}">
          <div class="s-l">スタート</div>
          <div class="s-v" style="font-size:18px">${c.turfStart ? "芝スタート" : "ダートスタート"}</div>
          <div class="s-d">${esc(c.startNote)}${c.turfStart ? "。外の枠ほど芝を長く走れて加速しやすい" : ""}</div>
        </div>` : "";
    return `<section class="card"><div class="card-h"><span class="ico" style="background:var(--us-soft);color:var(--us)">枠</span><h2>枠・人気・展開</h2><span class="en">Gate & pace</span></div>
      <div class="stats">${startStat}
        <div class="stat wide">
          <div class="s-l">枠の内外（複勝率）<span class="badge ${tagCls}">${esc(tag)}</span></div>
          <div class="duo"><span>内1-3枠 <b>${inn}%</b></span>
            <div class="track"><div class="l" style="width:${(inn / tot) * 100}%"></div><div class="r" style="width:${(out / tot) * 100}%"></div></div>
            <span>外6-8枠 <b>${out}%</b></span></div>
          <div class="s-d">最良／最低：${esc(e.wakuBest)}</div>
        </div>
        <div class="stat">
          <div class="s-l">1番人気級の複勝率</div>
          <div class="s-v">${fav ?? "-"}<small>%</small>${favTag}</div>
          <div class="s-d">${esc(favNote ? favNote.replace("単回", "単勝回収率") : "")}${/走のみ/.test(e.fav) ? "（走数が少ない）" : ""}</div>
        </div>
        <div class="stat">
          <div class="s-l">先行型 / 末脚型</div>
          <div class="s-v">${lead ?? "-"}<small>/</small> ${late ?? "-"}<small>%</small></div>
          <div class="s-d">${styleTag}</div>
        </div>
      </div></section>`;
  }

  function renderPeople(c) {
    const e = c.extra;
    if (!e || (!e.jockey && !e.damsire)) return "";
    return `<section class="card"><div class="card-h"><span class="ico" style="background:var(--gold-soft);color:var(--gold)">人</span><h2>騎手と母父</h2><span class="en">Jockey & damsire</span></div>
      <div class="kv">
        <div class="r"><span class="k">騎手</span><span>${e.jockey ? rich(e.jockey.split("／妙味 ")[0]) : "—"}${e.jockey && e.jockey.includes("妙味") ? `<br><span class="muted small">人気のわりに来る：</span>${rich(e.jockey.split("／妙味 ")[1])}` : ""}</span></div>
        <div class="r"><span class="k">母父</span><span>${e.damsire ? rich(e.damsire) : "—"}</span></div>
      </div></section>`;
  }

  function renderRain(c) {
    if (!c.heavy) return "";
    return `<section class="card rain"><div class="card-h"><span class="ico">☂</span><h2>雨の日（重・不良）</h2><span class="en">Wet track</span></div>
      <div class="kv">
        <div class="r"><span class="k">浮上</span><span>${c.heavy.up ? rich(c.heavy.up) : "—"}</span></div>
        <div class="r"><span class="k">沈む</span><span>${c.heavy.down ? rich(c.heavy.down) : "—"}</span></div>
      </div>
      <p class="note">ふだんと比べた「3着以内に入る割合」の倍率。回数が少ないので参考程度。芝とダートで逆になる理由は<a class="term" href="#lesson/7">レッスン7</a></p></section>`;
  }

  function renderTrack(v, c) {
    return `<section class="card"><div class="card-h"><span class="ico">場</span><h2>${v.name}競馬場のクセ</h2><span class="en">Course</span></div>
      <p style="margin:0 0 12px;font-size:14px">${esc(v.note)}</p>
      <div class="kv">
        <div class="r"><span class="k">芝</span><span>${esc(v.turf)}</span></div>
        <div class="r"><span class="k">ダート</span><span>${esc(v.dirt)}</span></div>
        <div class="r"><span class="k">芝の種類</span><span>${esc(v.grass)}</span></div>
      </div></section>`;
  }

  // ---------- blood home（レッスンの目次＋種牡馬図鑑） ----------
  const TYPE_EN = { 日: "JAPAN", 米: "AMERICA", 欧: "EUROPE" };
  const TYPE_SHORT = {
    日: "サンデー系だけ。直線で一気に加速する瞬発力",
    欧: "スタミナと馬力。時計のかかる馬場や長い距離。いまは芝マイルの主役も",
    米: "スピードの持続。ダートの1800mまでと、芝の短距離",
  };

  function renderBloodHome() {
    const ls = D.lessons.map((l) => `
      <a class="lrow" href="#lesson/${l.n}">
        <span class="ln num">${String(l.n).padStart(2, "0")}</span>
        <span class="lt"><b>${esc(l.title)}</b><span>${esc(l.summary)}</span></span>
        <span class="chev">›</span>
      </a>`).join("");
    const f = state.zukan;
    const filters = [["all", "全部"], ["日", "日本型"], ["欧", "欧州型"], ["米", "米国型"]]
      .map(([id, nm]) => `<button data-z="${id}" class="${f === id ? "is-active" : ""}">${nm}</button>`).join("");
    const groups = ["日", "欧", "米"].filter((t) => f === "all" || f === t).map((t) => {
      const list = D.sires.filter((s) => s.type === t);
      // 系統ごとにまとめる（データの並び順を保つ）
      const lines = [...new Set(list.map((s) => s.line))];
      const body = lines.map((ln) => `
        <div class="zline"><span>${esc(ln)}</span></div>
        ${list.filter((s) => s.line === ln).map((s) => `
          <a class="zrow" href="${sireHref(s.name)}">
            <span class="zn">${esc(s.name)}${s.rows ? "" : '<small class="muted">（祖先）</small>'}</span>
            <span class="zt">${esc(s.tagline)}</span>
            <span class="chev">›</span>
          </a>`).join("")}`).join("");
      return `<section class="zgroup" style="--c:${TYPE_COLOR[t]}">
        <div class="zhead"><h3>${TYPE_NAME[t]}<span class="en">${TYPE_EN[t]}</span></h3><p>${TYPE_SHORT[t]}</p></div>
        ${body}
      </section>`;
    }).join("");
    $view.innerHTML = `
      <div class="fade">
        <div class="page-h"><h1>血統</h1><p>レッスンで考え方を学び、図鑑で種牡馬を引く。土台は亀谷敬正さんの「血統ビーム」の分類。</p></div>
        <section class="card"><div class="card-h"><span class="ico" style="background:var(--accent-soft);color:var(--accent)">学</span><h2>レッスン</h2><span class="en">Lessons</span></div>
          <div class="lrows">${ls}</div></section>
        <section class="card"><div class="card-h"><span class="ico" style="background:var(--eu-soft);color:var(--eu)">図</span><h2>種牡馬図鑑</h2><span class="en">${D.sires.length} sires</span></div>
          <div class="seg zseg">${filters}</div>
          ${groups}
        </section>
        <p class="foot">型・系統：血統ビーム公式サイト、スマート出馬表の出馬表<br>数字：スマート出馬表 5年集計（2021.11〜2026.11）</p>
      </div>`;
    $view.querySelectorAll("[data-z]").forEach((b) => b.onclick = () => { state.zukan = b.dataset.z; save(); renderBloodHome(); });
  }

  // ---------- sire page ----------
  const BAND_NAME = { 芝短: "芝 〜1400", 芝マ: "芝 1500〜1800", 芝中: "芝 2000〜2200", 芝長: "芝 2300〜", ダ短: "ダ 〜1400", ダ中: "ダ 1500〜1900", ダ長: "ダ 2000〜" };
  const nameLink = (n) => {
    if (!n) return "—";
    const base = n.replace(/（.*$/, "");
    const rest = n.slice(base.length);
    return SIRE[base] ? `${sireTag(base)}<span class="muted small">${esc(rest)}</span>` : `<span>${esc(base)}</span><span class="muted small">${esc(rest)}</span>`;
  };

  function renderSire(name) {
    const s = SIRE[name];
    if (!s) { $view.innerHTML = `<div class="fade">${backBtn()}<p class="empty">「${esc(name)}」は図鑑にありません。</p></div>`; return; }
    const father = SIRE[s.sire];
    const tree = `
      <div class="tree">
        ${father && father.sire ? `<div class="tr"><span class="k">父の父</span><span>${nameLink(father.sire)}</span></div>` : ""}
        <div class="tr"><span class="k">父</span><span>${nameLink(s.sire)}</span></div>
        <div class="tr me"><span class="k">この馬</span><span><b>${esc(s.name)}</b></span></div>
        <div class="tr"><span class="k">子</span><span>${s.children.length ? `<span class="chips">${s.children.map((c) => `<a class="chip" href="${sireHref(c)}">${esc(c)}</a>`).join("")}</span>` : '<span class="muted small">図鑑に載っている子はいない</span>'}</span></div>
        <div class="tr dam"><span class="k"><a class="term" href="#lesson/1">母父</a></span><span>${nameLink(s.damsire)}</span></div>
      </div>`;

    const reasons = (arr) => arr.map((x) => `
      <div class="rs"><div class="rs-c">${rich(x.cond, { terms: true })}</div>${x.why ? `<div class="rs-w"><span class="tg w">なぜ</span><span>${rich(x.why, { terms: true })}</span></div>` : ""}</div>`).join("");
    const theory = `<section class="card ip"><div class="card-h"><span class="tg w big">理屈</span><h2>解釈：どんな馬か</h2><span class="en">Why</span></div>
      ${s.desc ? `<p class="desc">${rich(s.desc, { terms: true })}</p>` : ""}
      ${s.good.length ? `<h4 class="sub good">得意</h4>${reasons(s.good)}` : ""}
      ${s.bad.length ? `<h4 class="sub bad">苦手</h4>${reasons(s.bad)}` : ""}
      ${s.notes.length ? `<h4 class="sub">ほかに</h4>${s.notes.map((n) => `<p class="desc">${rich(n, { terms: true })}</p>`).join("")}` : ""}
    </section>`;

    let facts = "";
    if (s.rows) {
      const bands = Object.keys(BAND_NAME).filter((b) => s.bands[b]).map((b) => {
        const [n, w, p, t, fu] = s.bands[b];
        const avg = D.bandAvg[b];
        const cls = p >= avg * 1.15 ? "hi" : p <= avg * 0.85 ? "lo" : "";
        return `<div class="bband ${cls}">
          <span class="bn">${BAND_NAME[b]}</span>
          <div class="btrack"><div class="bfill" style="width:${Math.min(p / 50, 1) * 100}%"></div><i class="bavg" style="left:${(avg / 50) * 100}%"></i></div>
          <span class="bv num">${p}%</span>
          <span class="bd">${n}走・勝率${w}%・単回${t}／複回${fu}</span>
        </div>`;
      }).join("");
      // 「得」「妙」「苦」は集計のときに選んだ行。買い／消しやコース上位から来た行（買・主）も、条件に合えば足す
      const extra = (r) => r.tag === "買" || r.tag === "主";
      const pick = {
        得: (r) => r.tag === "得" || (extra(r) && isGood(r)),
        妙: (r) => r.tag === "妙" || (extra(r) && !isGood(r) && isValue(r)),
        苦: (r) => r.tag === "苦" || (extra(r) && isWeak(r)),
      };
      const sorter = { 得: (a, b) => b.p / b.avg - a.p / a.avg, 妙: (a, b) => b.f - a.f, 苦: (a, b) => a.p / a.avg - b.p / b.avg };
      const table = (tag, title, note) => {
        const rows = s.rows.filter(pick[tag]).sort(sorter[tag]).slice(0, 8);
        if (!rows.length) return "";
        return `<h4 class="sub">${title}</h4>${note ? `<p class="note" style="margin:-4px 0 6px">${note}</p>` : ""}
          <div class="crows">${rows.map((r) => `
            <a class="crow" href="#course" data-course="${esc(r.k)}">
              <span class="crow-k">${esc(cname(r.k))}<span class="crow-l">${labels(r)}</span></span>
              <span class="crow-p num">${r.p}<small>%</small></span>
              <span class="crow-d">${r.n}走・平均${r.avg}%・単回${r.t}／複回${r.f}</span>
            </a>`).join("")}</div>`;
      };
      facts = `<section class="card fx"><div class="card-h"><span class="tg f big">数字</span><h2>事実：5年間の成績</h2><span class="en">Data</span></div>
        <h4 class="sub" style="margin-top:0">距離ごとの複勝率</h4>
        <p class="note" style="margin:-4px 0 8px">棒の縦線は、その距離帯全体の平均。<span class="hi-t">緑</span>は平均より高く、<span class="lo-t">赤</span>は低い</p>
        <div class="bbands">${bands}</div>
        ${table("得", "よく来るコース", "複勝率がコース平均より高い順（＝結果）")}
        ${table("妙", "人気のわりに来たコース", "過去の回収率が高い（＝妙味）。今日のオッズの妙味ではない")}
        ${table("苦", "来ていないコース", "")}
        <p class="note">複勝率＝3着以内に入った割合。単回・複回＝単勝・複勝の回収率（100%超で、買い続けたらプラス）。<a class="term" href="#lesson/8">レッスン8</a></p>
      </section>`;
    } else {
      facts = `<section class="card fx"><div class="card-h"><span class="tg f big">数字</span><h2>事実</h2><span class="en">Data</span></div>
        <p class="note" style="margin:0">本人の産駒はいまほとんど走っていないので、成績は載せていない。子どもたちのページを見てほしい。</p></section>`;
    }

    const wet = s.wet || [];
    const up = wet.filter((w) => w.d === "up"), down = wet.filter((w) => w.d === "down");
    const wetList = (arr) => arr.map((w) => `<a class="wchip" href="#course" data-course="${esc(w.k)}">${esc(cname(w.k))} <b class="num">${esc(w.x)}</b></a>`).join("");
    const rain = (s.rain || wet.length) ? `<section class="card rain"><div class="card-h"><span class="ico">☂</span><h2>雨の日（重・不良）</h2><span class="en">Wet track</span></div>
      ${wet.length ? `<div class="sn-l" style="margin-bottom:8px"><span class="tg f">数字</span><span class="muted small">ふだんと比べた「3着以内に入る割合」の倍率</span></div>
        ${up.length ? `<div class="wrow"><span class="k up">浮上</span><div class="wchips">${wetList(up)}</div></div>` : ""}
        ${down.length ? `<div class="wrow"><span class="k down">沈む</span><div class="wchips">${wetList(down)}</div></div>` : ""}` : ""}
      ${s.rain ? `<div class="sn-l" style="margin-top:10px"><span class="tg w">理屈</span><span>${rich(s.rain, { terms: true })}</span></div>` : ""}
      <p class="note">芝の重とダートの重は逆になる。<a class="term" href="#lesson/7">レッスン7</a></p>
    </section>` : "";

    $view.innerHTML = `
      <div class="fade">
        ${backBtn()}
        <section class="shero" style="--c:${TYPE_COLOR[s.type]}">
          <div class="shero-en">${TYPE_EN[s.type]} TYPE SIRE</div>
          <h1>${esc(s.name)}</h1>
          <div class="pills">
            <a class="pill ptype" href="#lesson/2">${TYPE_NAME[s.type]}${s.typeSure ? "" : "（推定）"}</a>
            <a class="pill" href="#lesson/3">${esc(s.line)}${s.lineGuess ? "（推定）" : ""}</a>
            ${s.big && s.big !== s.line ? `<span class="pill">${esc(s.big)}</span>` : ""}
          </div>
          <p class="tagline">${rich(s.tagline)}</p>
        </section>
        <section class="card"><div class="card-h"><span class="ico">系</span><h2>血のつながり</h2><span class="en">Family</span></div>${tree}</section>
        ${theory}
        ${facts}
        ${rain}
        <p class="foot">数字：スマート出馬表 5年集計（2021.11〜2026.11）。雨：同じ集計の重・不良<br>理屈は一般的な考え方と亀谷敬正さんの公開情報をもとにした自分用の解釈。「推定」は未確認</p>
      </div>`;
  }

  // ---------- lesson page ----------
  function renderLesson(n) {
    const l = D.lessons.find((x) => x.n === n);
    if (!l) { go("#blood"); return; }
    const body = l.blocks.map((b) => {
      if (b.t === "h") return `<h3 class="lh">${esc(b.text)}</h3>`;
      if (b.t === "p") return `<p>${rich(b.text)}</p>`;
      if (b.t === "ul") return `<ul class="lul">${b.items.map((i) => `<li class="${i.sub ? "sub" : ""}">${rich(i.text)}</li>`).join("")}</ul>`;
      return "";
    }).join("");
    const ex = l.blocks.filter((b) => b.t === "ex").map((b) => `
      <div class="ex">
        <a class="ex-k" href="#course" data-course="${esc(b.k)}">${esc(cname(b.k))}<span class="chev">›</span></a>
        <span class="ex-t">${rich(b.text)}</span>
      </div>`).join("");
    const prev = D.lessons.find((x) => x.n === n - 1), next = D.lessons.find((x) => x.n === n + 1);
    $view.innerHTML = `
      <div class="fade">
        ${backBtn()}
        <section class="lhero">
          <div class="lnum num">LESSON ${String(n).padStart(2, "0")}<span>${esc(l.en)}</span></div>
          <h1>${esc(l.title)}</h1>
          <p>${esc(l.summary)}</p>
        </section>
        <article class="card lbody">${body}</article>
        ${ex ? `<section class="card"><div class="card-h"><span class="ico" style="background:var(--accent-soft);color:var(--accent)">例</span><h2>実際のコースで見る</h2><span class="en">Examples</span></div>
          <div class="exs">${ex}</div><p class="note">数字はスマート出馬表の5年集計。タップでそのコースの画面へ。</p></section>` : ""}
        <nav class="lnav">
          ${prev ? `<a href="#lesson/${prev.n}" class="lprev"><span>‹ ${String(prev.n).padStart(2, "0")}</span>${esc(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a href="#lesson/${next.n}" class="lnext"><span>${String(next.n).padStart(2, "0")} ›</span>${esc(next.title)}</a>` : "<span></span>"}
        </nav>
      </div>`;
  }

  const backBtn = () => "";  // 戻るボタンは上の帯に移した

  // ---------- skins ----------
  const SKINS = [
    { id: "midnight", name: "Midnight" },
    { id: "daylight", name: "Daylight" },
    { id: "paddock", name: "Paddock" },
  ];
  function applySkin() {
    const s = SKINS.find((x) => x.id === state.skin) || SKINS[0];
    document.documentElement.dataset.skin = s.id;
    const b = document.getElementById("skin");
    if (b) b.querySelector("span").textContent = s.name;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0b0f0d";
  }
  const skinBtn = document.getElementById("skin");
  if (skinBtn) skinBtn.onclick = () => {
    const i = SKINS.findIndex((x) => x.id === state.skin);
    state.skin = SKINS[(i + 1) % SKINS.length].id; save(); applySkin();
  };
  applySkin();

  // ---------- routing（#course / #blood / #sire/名前 / #lesson/番号） ----------
  // iPhoneのホーム画面版には戻るボタンがないので、画面の中に「戻る」を置く。
  const scrollMem = {};
  let depth = 0;
  const curHash = () => { try { return decodeURIComponent(location.hash || "#course"); } catch { return location.hash; } };
  function go(hash) {
    if (hash === curHash()) { render(); return; }
    scrollMem[curHash()] = window.scrollY;
    delete scrollMem[hash];
    depth++;
    location.hash = hash;
  }
  function back() {
    if (depth > 0) { depth--; history.back(); }
    else go(/^#sire|^#lesson/.test(curHash()) ? "#blood" : "#course");
  }

  function render() {
    const h = curHash().slice(1);
    const [r, arg] = [h.split("/")[0], h.slice(h.indexOf("/") + 1)];
    const tab = r === "course" || !r ? "course" : "blood";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
    // 図鑑・レッスンのページでは、上の帯に「戻る」を出す
    document.querySelector(".topbar")?.classList.toggle("sub", r === "sire" || r === "lesson");
    if (r === "sire") renderSire(arg);
    else if (r === "lesson") renderLesson(+arg);
    else if (r === "blood") renderBlood();
    else renderCourse();
    state.route = h || "course"; save();
    const y = scrollMem[curHash()];
    window.scrollTo({ top: y || 0 });
  }
  const renderBlood = renderBloodHome;

  window.addEventListener("hashchange", render);
  // リンクのタップをまとめて受ける（コースへのリンクは、選んでいるコースを切り替えてから移る）
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-back]");
    if (b) { e.preventDefault(); back(); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const ck = a.dataset.course;
    if (ck) {
      const [v, l] = ck.split("|");
      state.venue = v; state.label = l; state.surface = l.startsWith("芝") ? "芝" : "ダート"; save();
    }
    go(a.getAttribute("href"));
  });
  document.querySelectorAll(".tab").forEach((t) => t.onclick = () => { depth = 0; go("#" + t.dataset.tab); });

  if (!location.hash && state.route) history.replaceState(null, "", "#" + state.route);
  render();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.TURFNOTE_NO_SW) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
