// 画像の幾何解析（AI不使用）。
// 黒背景など「程々コントラストのある背景」に置かれた複数の証憑を、
// 二値化 + 連結成分で検出して矩形ごとに切り出す。
// chroma.js 等は使わないため decode/encode は jimp に依存する。
import { Jimp } from 'jimp';

// 解析用の作業画像の最大幅（リンク解析をこの解像度で行う。切り出しは原解像度）
const WORK_WIDTH = 1200;

// 膨張・収縮の半径（作業画像幅に対する比率。紙の中の文字・破線を埋めるのに必要なだけ）
const CLOSE_RATIO = 0.003;
// 撕れた紙片を統合する距離（軸方向のオーバーラップとセットで判定する）
const MERGE_RATIO = 0.005;
// これより小さい領域はノイズとして捨てる（画像面積に対する比率）
const MIN_AREA_RATIO = 0.02;
// 切り出しに付けるマージン（元画像の短辺に対する比率）
const MARGIN_RATIO = 0.015;

// 画像全体がカバーされた場合は「分離の余地がない」とみなす閾値（前景比率）
const TOO_FULL_RATIO = 0.9;

const median = (values) => {
  if ( values.length === 0 ) {
    return 0;
  }
  const sorted = [ ...values ].sort((a, b) => ( a - b ));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(( sorted[mid - 1] + sorted[mid] ) / 2);
};

const otsuThreshold = (array) => {
  const hist = new Array(256).fill(0);
  for ( const v of array ) {
    hist[v] += 1;
  }
  const total = array.length;
  let sum = 0;
  for ( let i = 0; i < 256; i += 1 ) {
    sum += i * hist[i];
  }
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 127;
  for ( let i = 0; i < 256; i += 1 ) {
    wB += hist[i];
    if ( wB === 0 ) continue;
    const wF = total - wB;
    if ( wF === 0 ) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = ( sum - sumB ) / wF;
    const between = wB * wF * ( mB - mF ) * ( mB - mF );
    if ( between > best ) {
      best = between;
      thr = i;
    }
  }
  return thr;
};

// 分離可分弁的な maxフィルタ（膨張）/ minフィルタ（収縮）。行・列の2パスで処理する
const morph = (mask, w, h, radius, useMax) => {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for ( let y = 0; y < h; y += 1 ) {
    for ( let x = 0; x < w; x += 1 ) {
      let v = useMax ? 0 : 1;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for ( let i = x0; i <= x1; i += 1 ) {
        const m = mask[y * w + i];
        v = useMax ? ( m || v ) : ( m && v );
      }
      tmp[y * w + x] = v;
    }
  }
  for ( let y = 0; y < h; y += 1 ) {
    for ( let x = 0; x < w; x += 1 ) {
      let v = useMax ? 0 : 1;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for ( let i = y0; i <= y1; i += 1 ) {
        const m = tmp[i * w + x];
        v = useMax ? ( m || v ) : ( m && v );
      }
      out[y * w + x] = v;
    }
  }
  return out;
};

// 8近傍連結成分のラベリング（明示スタックで flood fill）。ボックスの配列を返す
const connectedComponents = (mask, w, h) => {
  const boxes = [];
  const seen = new Uint8Array(w * h);
  const stack = [];
  for ( let i = 0; i < w * h; i += 1 ) {
    if ( !mask[i] || seen[i] ) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let area = 0;
    while ( stack.length > 0 ) {
      const p = stack.pop();
      const px = p % w;
      const py = Math.floor(p / w);
      area += 1;
      if ( px < x0 ) x0 = px;
      if ( px > x1 ) x1 = px;
      if ( py < y0 ) y0 = py;
      if ( py > y1 ) y1 = py;
      for ( let dy = -1; dy <= 1; dy += 1 ) {
        for ( let dx = -1; dx <= 1; dx += 1 ) {
          const nx = px + dx;
          const ny = py + dy;
          if ( nx < 0 || ny < 0 || nx >= w || ny >= h ) continue;
          const q = ny * w + nx;
          if ( mask[q] && !seen[q] ) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    boxes.push({ x0, y0, x1, y1, area });
  }
  return boxes;
};

// 撕れた紙片の統合。隣接した別の証憑（横に並ぶ等）と区別するため、
// 「軸方向のオーバーラップが十分ある」時にだけ距離 gap 以内を統合する
const mergeBoxes = (boxes, gap) => {
  let current = boxes.map((b) => ({ ...b }));
  let changed = true;
  while ( changed && current.length > 1 ) {
    changed = false;
    // 面積の大きい順に統合する（小さいものが大きなものに呑まれて消えるのを防ぐ）
    current.sort((a, b) => ( b.area - a.area ));
    for ( let i = 0; i < current.length && !changed; i += 1 ) {
      for ( let j = i + 1; j < current.length; j += 1 ) {
        const a = current[i];
        const b = current[j];
        const overX = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
        const overY = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
        const minX = Math.min(a.x1 - a.x0, b.x1 - b.x0);
        const minY = Math.min(a.y1 - a.y0, b.y1 - b.y0);
        const gapY = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
        const gapX = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
        const joinable =
          ( overX >= minX * 0.25 && gapY <= gap ) ||
          ( overY >= minY * 0.25 && gapX <= gap );
        if ( !joinable ) {
          continue;
        }
        a.x0 = Math.min(a.x0, b.x0);
        a.y0 = Math.min(a.y0, b.y0);
        a.x1 = Math.max(a.x1, b.x1);
        a.y1 = Math.max(a.y1, b.y1);
        a.area += b.area;
        current.splice(j, 1);
        changed = true;
        break;
      }
    }
  }
  return current;
};

const debug = ( ...args ) => {
  if ( process.env.IMAGING_DEBUG ) {
    console.log('[imaging]', ...args);
  }
};

/**
 * 1枚の画像に写った複数の証憑を検出して切り出す。
 * @param {Buffer} buffer 画像
 * @param {string} mimeType 元のMIME（'image/png' / 'image/jpeg' を保持する）
 * @return {Promise<{mime: string, parts: Buffer[]}|null>}
 *   2つ以上の証憑が検出できた場合は切り出し画像の配列、それ以外は null
 */
export const splitImage = async (buffer, mimeType = 'image/png') => {
  const img = await Jimp.read(buffer);
  const mime = ( /^image\/jpe?g$/i.test(mimeType || '') ) ? 'image/jpeg' : 'image/png';
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  if ( w < 2 || h < 2 ) {
    return null;
  }
  const scale = Math.min(1, WORK_WIDTH / w);
  const ww = Math.max(1, Math.round(w * scale));
  const wh = Math.max(1, Math.round(h * scale));

  // 解析解像度のRGBサンプル（nearest sampling）
  const src = img.bitmap.data;
  const samples = new Uint8Array(ww * wh * 3);
  for ( let y = 0; y < wh; y += 1 ) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for ( let x = 0; x < ww; x += 1 ) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      const i = ( sy * w + sx ) * 4;
      const o = ( y * ww + x ) * 3;
      samples[o] = src[i];
      samples[o + 1] = src[i + 1];
      samples[o + 2] = src[i + 2];
    }
  }

  // 背景色の推定: 画像の周辺帯の中央値
  const band = Math.max(2, Math.round(Math.min(ww, wh) * 0.02));
  const rs = [];
  const gs = [];
  const bs = [];
  for ( let y = 0; y < wh; y += 1 ) {
    const edge = ( y < band ) || ( y >= wh - band );
    for ( let x = 0; x < ww; x += 1 ) {
      if ( !edge && ( x >= band ) && ( x < ww - band ) ) continue;
      const o = ( y * ww + x ) * 3;
      rs.push(samples[o]);
      gs.push(samples[o + 1]);
      bs.push(samples[o + 2]);
    }
  }
  const br = median(rs);
  const bg = median(gs);
  const bb = median(bs);

  // 背景色からの距離（ hueを問わず背景と違うものが前景）
  const dist255 = new Uint8Array(ww * wh);
  for ( let i = 0; i < ww * wh; i += 1 ) {
    const dr = samples[i * 3] - br;
    const dg = samples[i * 3 + 1] - bg;
    const db = samples[i * 3 + 2] - bb;
    dist255[i] = Math.min(255, Math.round(Math.sqrt(dr * dr + dg * dg + db * db) / 442 * 255));
  }

  const thr = otsuThreshold(dist255);
  const bright = new Uint8Array(ww * wh);
  for ( let i = 0; i < ww * wh; i += 1 ) {
    bright[i] = dist255[i] > thr ? 1 : 0;
  }
  // 前景がほぼ全体を覆うなら分割の余地がない
  let count = 0;
  for ( let i = 0; i < bright.length; i += 1 ) {
    count += bright[i];
  }
  if ( count >= bright.length * TOO_FULL_RATIO ) {
    return null;
  }
  if ( count === 0 ) {
    return null;
  }

  // ノイズ除去（opening）と、紙の中の暗い線を埋める（closing）
  const openRadius = Math.max(1, Math.round(ww * 0.004));
  const closeRadius = Math.max(2, Math.round(ww * CLOSE_RATIO));
  const eroded = morph(bright, ww, wh, openRadius, false);
  const opened = morph(eroded, ww, wh, openRadius, true);
  const dilated = morph(opened, ww, wh, closeRadius, true);
  const solid = morph(dilated, ww, wh, closeRadius, false);

  let boxes = connectedComponents(solid, ww, wh)
    .filter((b) => ( b.area >= ww * wh * MIN_AREA_RATIO ));
  debug('components:', connectedComponents(solid, ww, wh).length, 'filtered:', boxes.length,
    'thr:', thr, 'bright ratio:', Math.round(100 * count / bright.length) / 100,
    'boxes:', boxes.map((b) => `(${b.x0},${b.y0})-(${b.x1},${b.y1})`));
  if ( boxes.length === 0 ) {
    return null;
  }
  boxes = mergeBoxes(boxes, Math.round(ww * MERGE_RATIO));

  // 切り出し（原解像度で行い、短辺基準のマージンを padding する）
  const margins = Math.max(2, Math.round(Math.min(w, h) * MARGIN_RATIO));
  const parts = [];
  for ( const b of boxes ) {
    const x0 = Math.max(0, Math.floor(b.x0 / scale) - margins);
    const y0 = Math.max(0, Math.floor(b.y0 / scale) - margins);
    const x1 = Math.min(w, Math.ceil(( b.x1 + 1 ) / scale) + margins);
    const y1 = Math.min(h, Math.ceil(( b.y1 + 1 ) / scale) + margins);
    if ( x1 - x0 < 8 || y1 - y0 < 8 ) continue;
    const crop = img.clone().crop({
      x: x0, y: y0,
      w: x1 - x0, h: y1 - y0
    });
    parts.push(await crop.getBuffer(mime));
  }
  if ( parts.length < 2 ) {
    return null;
  }
  return { mime, parts };
};

export default splitImage;
