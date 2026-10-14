// 画像の幾何解析（AI不使用）。
// 黒背景など「程々コントラストのある背景」に置かれた複数の証憑を、
// 二値化 + 連結成分で検出して矩形ごとに切り出す。切り出す際には
// 段階erodeで接触・重なりの接続部を救済し、Hough変換で傾きを検出して正立させる。
// decode/encode は jimp に依存する。
import { Jimp } from 'jimp';

// 解析用の作業画像の最大幅（連結解析はこの解像度で行う。切り出しは原解像度）
const WORK_WIDTH = 1200;

// 膨張・収縮の半径（作業画像幅に対する比率。紙の中の文字・破線を埋めるのに必要なだけ）
const CLOSE_RATIO = 0.003;
// 撕れた紙片を統合する距離（軸方向のオーバーラップとセットで判定する）
const MERGE_RATIO = 0.005;
// これより小さい領域はノイズとして捨てる（画像面積に対する比率）
const MIN_AREA_RATIO = 0.02;
// 切り出しに付けるマージン（元画像の短辺に対する比率）
const MARGIN_RATIO = 0.015;

// 画像全体が前景で覆われた場合は「分離の余地がない」とみなす
const TOO_FULL_RATIO = 0.9;

// bridge救済のerode最大半径（作業画像幅に対する比率）
const BRIDGE_ERODE_RATIO = 0.05;
// bridge救済で分割を「成立」と認める最小断片面積（画像面積に対する比率）
const SPLIT_ACK_RATIO = 0.004;
// この角度以上の傾きなら正立化する（度）
const STRAIGHTEN_MIN_DEG = 2;

const debug = ( ...args ) => {
  if ( process.env.IMAGING_DEBUG ) {
    console.log('[imaging]', ...args);
  }
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

// 分離可能な maxフィルタ（膨張）/ minフィルタ（収縮）。行・列の2パスで処理する
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

// 4近傍のerode（1回）
const erode1 = (mask, w, h) => {
  const out = new Uint8Array(w * h);
  for ( let y = 1; y < h - 1; y += 1 ) {
    for ( let x = 1; x < w - 1; x += 1 ) {
      const i = y * w + x;
      out[i] = ( mask[i] && mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w] ) ? 1 : 0;
    }
  }
  return out;
};

// 8近傍連結成分のラベリング。ボックス配列とラベルマップ（0=背景）を返す
const connectedComponents = (mask, w, h) => {
  const labels = new Int32Array(w * h);
  const boxes = [];
  const stack = [];
  let next = 0;
  for ( let i = 0; i < w * h; i += 1 ) {
    if ( !mask[i] || labels[i] ) continue;
    next += 1;
    stack.length = 0;
    stack.push(i);
    labels[i] = next;
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
          if ( mask[q] && !labels[q] ) {
            labels[q] = next;
            stack.push(q);
          }
        }
      }
    }
    boxes.push({ x0, y0, x1, y1, area, label: next });
  }
  return { boxes, labels };
};

// 撕れた紙片の統合。隣接した別の証憑（横に並ぶ等）と区別するため、
// 「軸方向のオーバーラップが十分ある」時にだけ距離 gap 以内を統合する
const mergeBoxes = (boxes, gap) => {
  let current = boxes.map((b) => ({ ...b }));
  let changed = true;
  while ( changed && current.length > 1 ) {
    changed = false;
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

// ラベルマップから指定ラベル部分を、矩形に切り出した領域として取り出す
const extractRegionFromMask = (mask, w, label) => {
  let x0 = w;
  let y0 = mask.length;
  let x1 = -1;
  let y1 = -1;
  for ( let i = 0; i < mask.length; i += 1 ) {
    if ( mask[i] === label ) {
      const x = i % w;
      const y = Math.floor(i / w);
      if ( x < x0 ) x0 = x;
      if ( x > x1 ) x1 = x;
      if ( y < y0 ) y0 = y;
      if ( y > y1 ) y1 = y;
    }
  }
  if ( x1 < 0 ) {
    return null;
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const sub = new Uint8Array(bw * bh);
  for ( let y = 0; y < bh; y += 1 ) {
    for ( let x = 0; x < bw; x += 1 ) {
      sub[y * bw + x] = mask[( y0 + y ) * w + ( x0 + x )] === label ? 1 : 0;
    }
  }
  return { x0, y0, w: bw, h: bh, mask: sub };
};

// 接触・重なりの救済: 領域マスクを段階的にerodeしていき、
// 分割が発生したらその時点の断片（面積が実質のあるもの）をシードとして
// マスク内でBFS（測地距離）拡張して元の領域を2つ以上に分ける。
// 紙の内部に細い腰が無い普通の1枚は分割が成立しない（erodeで消えるまで分割しない）
const splitBridges = (region, fullArea) => {
  const ackMin = Math.round(fullArea * SPLIT_ACK_RATIO);
  const bw = region.w;
  const bh = region.h;
  const maxR = Math.max(4, Math.round(bw * BRIDGE_ERODE_RATIO));
  let work = region.mask;
  let seeds = null;
  for ( let r = 0; r <= maxR && !seeds; r += 1 ) {
    if ( r >= 1 ) {
      work = erode1(work, bw, bh);
    }
    let any = false;
    for ( let i = 0; i < work.length; i += 1 ) {
      if ( work[i] ) { any = true; break; }
    }
    if ( !any ) {
      debug('bridge erosion: eroded away without split (r=', r, ')');
      return null;
    }
    const comps = connectedComponents(work, bw, bh);
    const big = comps.boxes.filter(( c ) => ( c.area >= ackMin ));
    if ( big.length === 2 ) {
      // ちょうど2つに分かれた時点が真のbridge断ち切り。
      // （3つ以上に分かれるのはX字状の重なり断片の可能性があるため、
      //   さらにerodeして2分割に噛み合う半径を探す）
      seeds = comps;
    }
  }
  if ( !seeds ) {
    debug('bridge erosion: no split found');
    return null;
  }
  // シードをマスク内でBFS拡張して、領域全体を復元する
  const claimed = new Int32Array(bw * bh);
  const queue = [];
  const bigLabels = new Map();
  for ( const b of seeds.boxes ) {
    if ( b.area >= ackMin ) {
      bigLabels.set(b.label, true);
    }
  }
  for ( let i = 0; i < bw * bh; i += 1 ) {
    if ( region.mask[i] && seeds.labels[i] && bigLabels.has(seeds.labels[i]) ) {
      claimed[i] = seeds.labels[i];
      queue.push(i);
    }
  }
  let head = 0;
  while ( head < queue.length ) {
    const p = queue[head++];
    const px = p % bw;
    const py = Math.floor(p / bw);
    for ( let dy = -1; dy <= 1; dy += 1 ) {
      for ( let dx = -1; dx <= 1; dx += 1 ) {
        const nx = px + dx;
        const ny = py + dy;
        if ( nx < 0 || ny < 0 || nx >= bw || ny >= bh ) continue;
        const q = ny * bw + nx;
        if ( region.mask[q] && !claimed[q] ) {
          claimed[q] = claimed[p];
          queue.push(q);
        }
      }
    }
  }
  const out = [];
  const seen = new Set();
  for ( let i = 0; i < bw * bh; i += 1 ) {
    if ( claimed[i] && !seen.has(claimed[i]) ) {
      seen.add(claimed[i]);
      const r = extractRegionFromMask(claimed, bw, claimed[i]);
      if ( r ) {
        out.push(r);
        debug('bridge split: box', r.x0 + region.x0, r.y0 + region.y0, r.w, r.h);
      }
    }
  }
  if ( out.length !== 2 ) {
    return null;
  }
  // 2つの断片の接触幅が広い場合（領収書内部の罫線など全幅で分かれた
  // 状態が分割されるケース）は真のbridgeではないので救済を取り消す
  const [ a, b ] = out;
  let interface_ = 0;
  for ( let y = 0; y < bh; y += 1 ) {
    for ( let x = 0; x < bw - 1; x += 1 ) {
      const i = y * bw + x;
      if ( claimed[i] && claimed[i + 1] && claimed[i] !== claimed[i + 1] ) {
        interface_ += 1;
      }
    }
  }
  for ( let y = 0; y < bh - 1; y += 1 ) {
    for ( let x = 0; x < bw; x += 1 ) {
      const i = y * bw + x;
      if ( claimed[i] && claimed[i + bw] && claimed[i] !== claimed[i + bw] ) {
        interface_ += 1;
      }
    }
  }
  const maxInterface = Math.round(Math.min(a.w, b.w, Math.min(a.h, b.h)) * 0.15);
  if ( interface_ > maxInterface ) {
    debug('bridge split rejected: interface', interface_, '>', maxInterface);
    return null;
  }
  return out;
};

// 領域境界点のHough変換で最有力直線を検出し、
// 最寄りの90°軸からどれだけ傾いているか（±45°内）を返す
const estimateAngle = (region) => {
  const w = region.w;
  const h = region.h;
  const mask = region.mask;
  // 境界点（4近傍のどれかが領域外になっている領域画素）
  const points = [];
  for ( let y = 0; y < h; y += 1 ) {
    for ( let x = 0; x < w; x += 1 ) {
      const i = y * w + x;
      if ( !mask[i] ) continue;
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !mask[ i - 1 ] || !mask[ i + 1 ] ||
        !mask[ i - w ] || !mask[ i + w ];
      if ( edge ) {
        points.push([ x, y ]);
      }
    }
  }
  if ( points.length < 40 ) {
    debug('hough: too few boundary points (', points.length, ')');
    return 0;
  }
  if ( points.length > 20000 ) {
    const dec = Math.ceil(points.length / 20000);
    const slim = [];
    for ( let i = 0; i < points.length; i += dec ) {
      slim.push(points[i]);
    }
    points.length = 0;
    points.push(...slim);
  }
  // Hough変換（角度0-179°、rhoは2px間隔）
  const diag = Math.ceil(Math.hypot(w, h));
  const R = diag + 2;
  const acc = new Int32Array(180 * R);
  const cosT = new Float64Array(180);
  const sinT = new Float64Array(180);
  for ( let a = 0; a < 180; a += 1 ) {
    cosT[a] = Math.cos(a * Math.PI / 180);
    sinT[a] = Math.sin(a * Math.PI / 180);
  }
  for ( const p of points ) {
    for ( let a = 0; a < 180; a += 1 ) {
      const rho = Math.round(( p[0] * cosT[a] + p[1] * sinT[a] ) / 2) + R;
      acc[a * R + rho] += 1;
    }
  }
  // 各角度の最有力rhoの得票数を、その角度の直線構造の強さとする
  let bestA = 0;
  let bestV = 0;
  for ( let a = 0; a < 180; a += 1 ) {
    let v = 0;
    for ( let r = 0; r < R; r += 1 ) {
      if ( acc[a * R + r] > v ) {
        v = acc[a * R + r];
      }
    }
    if ( v > bestV ) {
      bestV = v;
      bestA = a;
    }
  }
  // 検出直線の方向 = normal(bestA) に対して +90°
  const direction = ( ( bestA + 90 ) % 180 );
  // 最寄りの90°軸（0°または90°の直線方向）からの偏角
  const tilt = ( ( direction + 45 ) % 90 ) - 45;
  debug('hough: best normal', bestA, 'direction', direction, 'tilt', tilt);
  return tilt;
};

// 回転後に前景bboxを取り直してタイトにクロップする
const reCrop = (img, bg, thr) => {
  const { width: w, height: h, data } = img.bitmap;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for ( let y = 0; y < h; y += 1 ) {
    for ( let x = 0; x < w; x += 1 ) {
      const i = ( y * w + x ) * 4;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      const d = Math.sqrt(dr * dr + dg * dg + db * db) / 442 * 255;
      if ( d > thr ) {
        if ( x < x0 ) x0 = x;
        if ( x > x1 ) x1 = x;
        if ( y < y0 ) y0 = y;
        if ( y > y1 ) y1 = y;
      }
    }
  }
  if ( x1 < 0 ) {
    return img;
  }
  const margin = 2;
  const x = clamp(x0 - margin, 0, w - 1);
  const y = clamp(y0 - margin, 0, h - 1);
  return img.clone().crop({
    x: x,
    y: y,
    w: Math.min(w - x, x1 - x + 1 + margin),
    h: Math.min(h - y, y1 - y + 1 + margin)
  });
};

// 周辺帯から背景を推定し、前景bboxでタイトにクロップする
const tighten = (img) => {
  const { width: w, height: h, data } = img.bitmap;
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const rs = [];
  const gs = [];
  const bs = [];
  for ( let y = 0; y < h; y += 1 ) {
    const edge = ( y < band ) || ( y >= h - band );
    for ( let x = 0; x < w; x += 1 ) {
      if ( !edge && ( x >= band ) && ( x < w - band ) ) continue;
      const i = ( y * w + x ) * 4;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
  const bg = [ median(rs), median(gs), median(bs) ];
  const dist = new Uint8Array(w * h);
  for ( let i = 0; i < w * h; i += 1 ) {
    const dr = data[i * 4] - bg[0];
    const dg = data[i * 4 + 1] - bg[1];
    const db = data[i * 4 + 2] - bg[2];
    dist[i] = Math.min(255, Math.round(Math.sqrt(dr * dr + dg * dg + db * db) / 442 * 255));
  }
  const thr = otsuThreshold(dist);
  return reCrop(img, bg, thr);
};

// 列ごとの前景画素数の谷（区切り線・隙間）を検出し、縦の全高で分ける。
// 白いシートに連結して印刷された帳票や、隙間がわずかな並びの救済用
const gapLineSplits = async (img, mime, scale, w, h, bright, ww, wh) => {
  // 列ごとの前景画素数
  const colCounts = new Int32Array(ww);
  for ( let x = 0; x < ww; x += 1 ) {
    let n = 0;
    for ( let y = 0; y < wh; y += 1 ) {
      if ( bright[y * ww + x] ) {
        n += 1;
      }
    }
    colCounts[x] = n;
  }
  // minフィルタ（窓は幅の2.5%）で谷を伸ばして拾いやすくする
  const win = Math.max(5, Math.round(ww * 0.025));
  const valleys = [];
  for ( let x = 0; x < ww; x += 1 ) {
    let m = colCounts[x];
    const x0 = Math.max(0, x - Math.floor(win / 2));
    const x1 = Math.min(ww - 1, x + Math.floor(win / 2));
    for ( let i = x0; i <= x1; i += 1 ) {
      if ( colCounts[i] < m ) {
        m = colCounts[i];
      }
    }
    valleys.push(m);
  }
  const need = Math.round(wh * 0.06);
  const cols = [];
  for ( let x = 0; x < ww; x += 1 ) {
    if ( valleys[x] <= need ) {
      cols.push(x);
    }
  }
  if ( cols.length === 0 ) {
    debug('gapLineSplits: no valley columns');
    return null;
  }
  // 近い列をクラスタ化して、幅の狭い（線らしい）クラスタだけを切り出し位置にする
  const clusters = [];
  let cur = [ cols[0] ];
  for ( let i = 1; i < cols.length; i += 1 ) {
    if ( cols[i] - cur[cur.length - 1] <= 4 ) {
      cur.push(cols[i]);
    } else {
      clusters.push(cur);
      cur = [ cols[i] ];
    }
  }
  clusters.push(cur);
  const maxWidth = Math.round(ww * 0.05);
  const cuts = clusters
    .filter(( c ) => ( c.length <= maxWidth ))
    .map(( c ) => Math.round(( c[0] + c[c.length - 1] ) / 2 ));
  debug('gapLineSplits: clusters', clusters.length, 'cuts', cuts);
  if ( cuts.length === 0 ) {
    return null;
  }
  // 切り出し（元解像度。縦は全高、横は谷で分ける）
  const minWidth = Math.max(8, Math.round(ww * 0.08));
  const margin = Math.max(2, Math.round(Math.min(w, h) * MARGIN_RATIO));
  const segs = [];
  let prev = 0;
  for ( const cut of cuts ) {
    if ( cut - prev >= minWidth ) {
      segs.push([ prev, cut ]);
      prev = cut;
    }
  }
  if ( ww - prev >= minWidth ) {
    segs.push([ prev, ww ]);
  }
  if ( segs.length < 2 ) {
    return null;
  }
  const parts = [];
  for ( const [ x0, x1 ] of segs ) {
    const cx0 = clamp(Math.floor(x0 / scale) - margin, 0, w - 1);
    const cx1 = clamp(Math.ceil(x1 / scale) + margin, 1, w);
    if ( cx1 - cx0 < 8 ) continue;
    let crop = img.clone().crop({ x: cx0, y: 0, w: cx1 - cx0, h: h });
    crop = tighten(crop);
    parts.push(await crop.getBuffer(mime));
  }
  debug('gapLineSplits: parts', parts.length);
  return parts.length >= 2 ? parts : null;
};

/**
 * 1枚の画像に写った複数の証憑を検出して切り出す。
 * 接触・重なって写った証憑はerode救済で分け、
 * 傾いた証憑はHough変換で傾きを検出して90°単位で正立させる。
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
  const bg = [ median(rs), median(gs), median(bs) ];

  // 背景色からの距離（ hueを問わず背景と違うものが前景）
  const dist255 = new Uint8Array(ww * wh);
  for ( let i = 0; i < ww * wh; i += 1 ) {
    const dr = samples[i * 3] - bg[0];
    const dg = samples[i * 3 + 1] - bg[1];
    const db = samples[i * 3 + 2] - bg[2];
    dist255[i] = Math.min(255, Math.round(Math.sqrt(dr * dr + dg * dg + db * db) / 442 * 255));
  }

  const thr = otsuThreshold(dist255);
  const bright = new Uint8Array(ww * wh);
  for ( let i = 0; i < ww * wh; i += 1 ) {
    bright[i] = dist255[i] > thr ? 1 : 0;
  }
  let count = 0;
  for ( let i = 0; i < bright.length; i += 1 ) {
    count += bright[i];
  }
  debug('thr:', thr, 'bright ratio:', Math.round(100 * count / bright.length) / 100);
  if ( count >= bright.length * TOO_FULL_RATIO ) {
    debug('too full, abort');
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

  const comps = connectedComponents(solid, ww, wh);
  let boxes = comps.boxes.filter(( b ) => ( b.area >= ww * wh * MIN_AREA_RATIO ));
  if ( boxes.length === 0 ) {
    debug('no components passed area filter');
    return null;
  }
  debug('components:', comps.boxes.length, 'filtered:', boxes.length,
        'boxes:', boxes.map((b) => `(${b.x0},${b.y0})-(${b.x1},${b.y1})`));

  // (1) blobパイプライン: 近接ボックスの統合 → bridge救済 → 正立化して切り出す
  const parts = await blobParts(img, mime, comps, boxes, ww, wh, scale, w, h, bg, thr);
  if ( parts ) {
    return { mime, parts };
  }

  // (2) フォールバック: 白いシートに青の区切り線で連結して印刷された
  //     帳票（電気料金の収納票など）を、区切り線の位置で分ける。
  //     blobパイプラインで分けられなかった（1塊になる）ときだけ試す
  const blueParts = await gapLineSplits(img, mime, scale, w, h, bright, ww, wh);
  if ( blueParts ) {
    return { mime, parts: blueParts };
  }
  debug('no split found');
  return null;
};

// blobパイプライン: 連結成分ごとに領域を取り出し、bridge救済→角度推定→正立化して切り出す。
// 2枚以上切り出せたら配列を、それ以外は null を返す
const blobParts = async (img, mime, comps, boxes, ww, wh, scale, w, h, bg, thr) => {
  // 近接しているボックスを統合する
  boxes = mergeBoxes(boxes, Math.round(ww * MERGE_RATIO));

  // 各領域を取り出し、bridge救済→角度推定→正立化して切り出す
  const margin = Math.max(2, Math.round(Math.min(w, h) * MARGIN_RATIO));
  const parts = [];
  for ( const box of boxes ) {
    const region = extractRegionFromMask(comps.labels, ww, box.label);
    if ( !region ) continue;
    const subRegions = splitBridges(region, ww * wh) || [ region ];
    debug('region', region.x0, region.y0, `${region.w}x${region.h}`, '→', subRegions.length);
    for ( const r of subRegions ) {
      // 作業座標→元座標に変換してクロップ（マージン付き）
      const cx0 = clamp(Math.floor(r.x0 / scale) - margin, 0, w - 1);
      const cy0 = clamp(Math.floor(r.y0 / scale) - margin, 0, h - 1);
      const cx1 = clamp(Math.ceil(( r.x0 + r.w ) / scale) + margin, 1, w);
      const cy1 = clamp(Math.ceil(( r.y0 + r.h ) / scale) + margin, 1, h);
      if ( cx1 - cx0 < 8 || cy1 - cy0 < 8 ) continue;
      const crop = img.clone().crop({
        x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0
      });
      const tilt = estimateAngle(r);
      if ( Math.abs(tilt) >= STRAIGHTEN_MIN_DEG ) {
        // 回転時の余白は推定背景色で埋める（再bbox検出で前景から除外するため）。
        // clone()はbackgroundを引き継がないので回転側に設定する
        const rot = crop.clone();
        rot.background = ( bg[0] << 24 ) | ( bg[1] << 16 ) | ( bg[2] << 8 ) | 0xff;
        // tiltは「時計回りが正」、jimpのrotateは「正で反時計回り」のため符号をそのまま渡す
        rot.rotate(tilt);
        const rc = reCrop(rot, bg, thr);
        parts.push(await rc.getBuffer(mime));
        debug('straighten: tilt', tilt.toFixed(2));
      } else {
        parts.push(await crop.getBuffer(mime));
      }
    }
  }
  if ( parts.length < 2 ) {
    debug('parts < 2, abort');
    return null;
  }
  return parts;
};

export default splitImage;
