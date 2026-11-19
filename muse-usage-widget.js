// Muse 使用量ウィジェット (Scriptable)
// 今週の残り利用枠・リセット日時・追加トークン残量をホーム画面に表示します。
// データは GitHub の公開リポジトリに置いた usage.json をキーなしで取得します。
// （置いてあるのは使用量の数字だけで、ログイン情報は含まれません）

const DATA_URL = "https://raw.githubusercontent.com/funakoshi-kazumi/muse-usage/main/usage.json";
const CACHE_NAME = "muse-usage-cache.json";

async function fetchUsage() {
  const req = new Request(DATA_URL);
  req.timeoutInterval = 15;
  const data = await req.loadJSON();
  if (data == null || data.weeklyRemainingPercent == null) {
    throw new Error("bad data");
  }
  // 成功したらキャッシュに保存（次回失敗時に使う）
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE_NAME);
  fm.writeString(path, JSON.stringify(data));
  return data;
}

function loadCache() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE_NAME);
  if (!fm.fileExists(path)) return null;
  try { return JSON.parse(fm.readString(path)); } catch (e) { return null; }
}

function barColor(remaining) {
  if (remaining < 10) return new Color("#e5484d"); // 赤
  if (remaining < 25) return new Color("#f5a524"); // 黄
  return new Color("#30a46c");                     // 緑
}

function drawBar(remaining) {
  const w = 260, h = 14;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.setFillColor(new Color("#3a3a3c"));
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, w, h), 7, 7);
  ctx.addPath(bg); ctx.fillPath();
  const fillW = Math.max(h, Math.round(w * remaining / 100));
  ctx.setFillColor(barColor(remaining));
  const fg = new Path();
  fg.addRoundedRect(new Rect(0, 0, fillW, h), 7, 7);
  ctx.addPath(fg); ctx.fillPath();
  return ctx.getImage();
}

async function buildWidget() {
  let usage = null, stale = false;
  try {
    usage = await fetchUsage();
  } catch (e) {
    usage = loadCache();
    stale = true;
  }

  const w = new ListWidget();
  w.setPadding(14, 16, 14, 16);

  const title = w.addText("Muse 今週の残り");
  title.font = Font.semiboldSystemFont(13);
  title.textColor = Color.gray();
  w.addSpacer(4);

  if (usage == null) {
    const t = w.addText("データを取得できませんでした");
    t.font = Font.systemFont(14);
    const s = w.addText("通信状態を確認してください");
    s.font = Font.systemFont(11);
    s.textColor = Color.gray();
    return w;
  }

  const remain = usage.weeklyRemainingPercent;
  const big = w.addText(`${remain}%`);
  big.font = Font.boldSystemFont(40);
  big.textColor = barColor(remain);
  w.addSpacer(4);

  const bar = w.addImage(drawBar(remain));
  bar.imageSize = new Size(260, 14);
  w.addSpacer(8);

  const reset = w.addText(`リセット: ${usage.resetsAtText ?? "-"}`);
  reset.font = Font.systemFont(13);

  if (usage.extraTokensLeft) {
    const ex = w.addText(`追加トークン残り: ${usage.extraTokensLeft}`);
    ex.font = Font.systemFont(13);
  }
  w.addSpacer(6);

  const upd = w.addText(`更新: ${usage.updatedAtText ?? "-"}${stale ? "（前回の数値）" : ""}`);
  upd.font = Font.systemFont(11);
  upd.textColor = Color.gray();

  // iOS の判断で更新されるが、目安として30分後を指定
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
