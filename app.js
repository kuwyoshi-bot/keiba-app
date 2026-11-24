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
  const state = Object.assign({ tab: "course", venue: "東京", surface: "芝", label: "芝1600", skin: "midnight" }, store.get("state", {}));
  const save = () => store.set("state", state);

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sireNames = Object.keys(D.sireType).sort((a, b) => b.length - a.length);
  const sireRe = new RegExp("(" + sireNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
  const rich = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(sireRe, (m) => `<span class="sire t-${D.sireType[m]}">${m}</span>`)
      .replace(/(\d+(?:\.\d+)?%)/g, '<span class="num">$1</span>');
  const coursesOf = (v, s) => D.courses.filter((c) => c.venue === v && c.surface === s);
  const find = () => D.courses.find((c) => c.venue === state.venue && c.label === state.label);
  const venueInfo = (v) => D.venues.find((x) => x.name === v);
  const pct = (s) => { const m = String(s || "").match(/(\d+)%/); return m ? +m[1] : null; };

  function ensureValid() {
    let list = coursesOf(state.venue, state.surface);
    if (!list.length) { state.surface = state.surface === "芝" ? "ダート" : "芝"; list = coursesOf(state.venue, state.surface); }
    if (!list.find((c) => c.label === state.label)) state.label = list[0]?.label;
  }

  const labelParts = (c) => {
    const tag = c.label.endsWith("外") ? "外回り" : c.venue === "新潟" && c.label === "芝1000" ? "直線" : "";
    return { surf: c.surface === "芝" ? "芝" : "ダート", dist: c.dist, tag };
  };

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
      const t = x.label.endsWith("外") ? "<small>外</small>" : "";
      return `<button class="dist ${x.label === state.label ? "is-active" : ""}" data-label="${x.label}">${x.dist}${t}</button>`;
    }).join("");

    const startPill = c.surface === "ダート"
      ? (c.turfStart ? `<span class="pill pill-turf">芝スタート</span>` : `<span class="pill">ダートスタート</span>`)
      : "";
    const pills = [
      startPill,
      `<span class="pill">${v.turn}</span>`,
      c.toCorner ? `<span class="pill">${esc(c.corner || "最初のコーナー")}まで <b>${esc(c.toCorner.replace(/^約/, "約 "))}</b></span>` : "",
      c.start ? `<span class="pill">発走：${esc(c.start.replace(/\*/g, ""))}</span>` : "",
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
              ${lp.tag ? `<span class="tag">${lp.tag}</span>` : ""}
            </div>
            <div class="pills">${pills}</div>
          </div>
        </section>

        ${renderBuyAvoid(c)}
        ${renderPoints(c)}
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

  function renderBuyAvoid(c) {
    if (!c.buy && !c.avoid) return "";
    const li = (arr, mk) => (arr || []).map((x) => `<li><span class="mk">${mk}</span><span>${rich(x)}</span></li>`).join("") || `<li class="empty">特になし</li>`;
    return `
      <div class="bs">
        <section class="card buy"><div class="card-h"><span class="ico">◎</span><h2>買い</h2><span class="en">Buy</span></div><ul class="list">${li(c.buy, "✓")}</ul></section>
        <section class="card avoid"><div class="card-h"><span class="ico">✕</span><h2>消し</h2><span class="en">Fade</span></div><ul class="list">${li(c.avoid, "✕")}</ul></section>
      </div>`;
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
      <p class="note">5年・<span class="num">${c.types.runs.toLocaleString()}</span>走。日本型＝サンデー系（瞬発力）、米国型＝スピードの持続、欧州型＝スタミナと馬力。</p></section>`;
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
      <p class="note">ふだんと比べた「3着以内に入る割合」の倍率。回数が少ないので参考程度。</p></section>`;
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

  // ---------- blood view ----------
  function renderBlood() {
    const by = { 日: [], 米: [], 欧: [] };
    Object.entries(D.sireType).forEach(([n, t]) => by[t] && by[t].push(n));
    const desc = {
      日: ["JAPAN", "サンデーサイレンス系だけ。直線で一気に加速する瞬発力。東京の芝2000など、大きなコースの中距離で強い。"],
      米: ["AMERICA", "スピードを長く保つ力。速いペースが得意で、ダートの1800mまでと短距離で強い。"],
      欧: ["EUROPE", "スタミナと馬力。時計のかかる馬場や長い距離が得意。いまは芝のマイル前後でも主役（ロードカナロア、エピファネイア、モーリス）。"],
    };
    const cards = ["日", "米", "欧"].map((t) => `
      <div class="tcard" style="--c:${TYPE_COLOR[t]}">
        <h3>${TYPE_NAME[t]}<span class="en">${desc[t][0]}</span></h3>
        <p>${desc[t][1]}</p>
        <div class="chips">${by[t].map((n) => `<span class="chip">${n}</span>`).join("")}</div>
      </div>`).join("");
    const hg = D.heavyGlobal.map((h) => `
      <div class="row"><div>${rich(h.sire)} <span class="muted small">— ${esc(h.trend.replace(/★/g, "").trim())}</span></div><div class="w">${esc(h.where)}</div></div>`).join("");
    $view.innerHTML = `
      <div class="fade">
        <div class="page-h"><h1>血統の3つの型</h1><p>亀谷敬正さんの「血統ビーム」の分類。型は系統ではなく種牡馬ごとに決まる。</p></div>
        <div class="typecards">${cards}</div>
        <section class="card rain"><div class="card-h"><span class="ico">☂</span><h2>雨で浮上・沈む種牡馬</h2><span class="en">Wet track</span></div>
          <p class="note" style="margin:0 0 10px">芝の重は時計がかかりパワー勝負。ダートの重は砂が締まって時計が速くなる。</p>
          <div class="hg">${hg}</div></section>
        <p class="foot">出典：血統ビーム公式サイト（k-beam.com）、スマート出馬表の出馬表、うまめし</p>
      </div>`;
  }

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

  // ---------- insight view (未使用) ----------
  function renderInsight() {
    const ins = [
      ["01", "芝は内枠、ダートは外枠", "最初のコーナーが近いほど内枠が有利。函館芝1800は内31%・外20%、中京芝1200は8枠が12%。芝スタートのダート（東京ダ1600、中山ダ1200など）は外枠。"],
      ["02", "新潟芝1000直線は外枠がすべて", "1枠の複勝率5%、8枠37%。荒れる（1番人気級でも56%）。"],
      ["03", "小回りダートの短距離は逃げ", "函館ダ1000は逃げの複勝率69%、小倉ダ1000は64%、札幌ダ1000は60%。"],
      ["04", "芝マイルは欧州型、芝2000〜2400は日本型", "東京芝1600は欧25%・日21%。京都芝2200外は日30%・欧20%。"],
      ["05", "ダートの米国型は1800mまで", "阪神ダ1800は米27%。2000mを超えると欧州型や日本型が逆転（東京ダ2100は欧23%・米18%）。"],
      ["06", "シニスターミニスター", "阪神・京都・福島のダ1700〜1800で軒並みトップ。阪神ダ1800は241走で複勝率39%。"],
      ["07", "キズナは人気のわりに走る", "阪神芝2000（単勝回収率253%）、福島芝2000（208%）、中京ダ1800（132%）。ただし阪神の芝の重では沈む。"],
      ["08", "堅いコースと荒れるコース", "堅い：函館芝1800・東京芝2000（1番人気級の複勝率86〜87%）。荒れる：新潟芝1000直線・中山ダ2400・新潟芝2000外。"],
    ];
    $view.innerHTML = `
      <div class="fade">
        <div class="page-h"><h1>全体の傾向</h1><p>全10場・約90コースを見渡してわかったこと。</p></div>
        <div class="insight">${ins.map(([n, h, p]) => `<div class="ins"><div class="n">${n}</div><h3>${esc(h)}</h3><p>${rich(p)}</p></div>`).join("")}</div>
        <p class="foot">数字は2021年11月〜2026年11月の集計（脚質のみ2023年〜）。</p>
      </div>`;
  }

  // ---------- tabs ----------
  function render() {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === state.tab));
    if (state.tab === "blood") renderBlood();
    else { state.tab = "course"; renderCourse(); }
  }
  document.querySelectorAll(".tab").forEach((t) => t.onclick = () => { state.tab = t.dataset.tab; save(); render(); window.scrollTo({ top: 0 }); });
  render();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.TURFNOTE_NO_SW) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
