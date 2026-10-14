import {assert} from 'chai';
import {Jimp} from 'jimp';
import {splitImage} from '../libs/imaging.js';

// 黒地に白/赤の矩形を置いた合成画像で検出を検証する（実画像に依存しない）

// rectを黒背景へ描画したPNGを生成する（x, y, w, h, color）
const makeImage = (w, h, rects) => {
  const img = new Jimp({ width: w, height: h, color: 0x101010ff });
  for ( const r of rects ) {
    const [ x, y, rw, rh, color ] = r;
    for ( let yy = y; yy < y + rh; yy += 1 ) {
      for ( let xx = x; xx < x + rw; xx += 1 ) {
        img.setPixelColor(color, xx, yy);
      }
    }
  }
  return img.getBuffer('image/png');
};

// 傾けた矩形（回転しない軸に沿わない）を黒背景へ描画したPNGを生成する
const makeSlantedImage = (w, h, rects) => {
  const img = new Jimp({ width: w, height: h, color: 0x101010ff });
  for ( const r of rects ) {
    const [ cx, cy, rw, rh, angleDeg, color ] = r;
    const a = angleDeg * Math.PI / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rad = Math.ceil(Math.hypot(rw, rh) / 2) + 2;
    for ( let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y += 1 ) {
      for ( let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x += 1 ) {
        if ( x < 0 || y < 0 || x >= w || y >= h ) continue;
        const dx = x - cx;
        const dy = y - cy;
        const u = dx * ca + dy * sa;
        const v = -dx * sa + dy * ca;
        if ( Math.abs(u) <= rw / 2 && Math.abs(v) <= rh / 2 ) {
          img.setPixelColor(color, x, y);
        }
      }
    }
  }
  return img.getBuffer('image/png');
};

describe('imaging (splitImage)', () => {
  it('黒背景に離れて置かれた矩形を2つに分離する', async () => {
    const buf = await makeImage(800, 600, [
      [ 80, 80, 200, 300, 0xf8f8f8ff ],
      [ 450, 150, 220, 350, 0xffffffff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNotNull(result);
    assert.equal(result.mime, 'image/png');
    assert.equal(result.parts.length, 2);
  });

  it('1枚しか写っていない画像は null を返す', async () => {
    const buf = await makeImage(800, 600, [
      [ 120, 100, 400, 350, 0xf5f5f5ff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNull(result);
  });

  it('明暗が混在（白背景の一部に暗い紙）でも明クラス側の矩形は1つとして扱う', async () => {
    // 「白バックは期待しない」前提だが、暗い紙は背景と区別できず null を返す
    const buf = await makeImage(800, 600, [
      [ 80, 80, 200, 300, 0xf0eae0ff ],
      [ 450, 150, 220, 350, 0x303030ff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNull(result);
  });

  it('JPEGソースではJPEGで切り出される', async () => {
    const png = await makeImage(800, 600, [
      [ 80, 80, 200, 300, 0xf8f8f8ff ],
      [ 450, 150, 220, 350, 0xffffffff ]
    ]);
    // PNGをJPEGに変換してから分離する
    const img = await Jimp.read(png);
    const jpeg = await img.getBuffer('image/jpeg');
    const result = await splitImage(jpeg, 'image/jpeg');
    assert.isNotNull(result);
    assert.equal(result.mime, 'image/jpeg');
    assert.equal(result.parts.length, 2);
  });

  it('非常に近接した矩形は同じ証憑として統合される（遠くの矩形と合わせて2つに分離）', async () => {
    // 隙間3px程度（closing半径2px相当）で橋渡しされて1つの矩形に統合され、
    // 離れた第3の矩形とは分離される。実際の切り出しは2枚になる
    const buf = await makeImage(800, 900, [
      [ 150, 100, 300, 250, 0xf8f8f8ff ],
      [ 100, 352, 340, 300, 0xf5f5f5ff ],
      [ 520, 560, 200, 250, 0xf0f0f0ff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNotNull(result);
    assert.equal(result.parts.length, 2);
  });

  it('傾いた矩形は正立化される（縦長を保つ）', async () => {
    // 25°傾けた縦長矩形（220x500）と直立の矩形（200x400）
    const buf = await makeSlantedImage(900, 900, [
      [ 300, 450, 220, 500, 25, 0xfafafaff ],
      [ 700, 300, 200, 400, 0, 0xfafafaff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNotNull(result);
    assert.equal(result.parts.length, 2);
    const tilted = await Jimp.read(result.parts[0]);
    const upright = await Jimp.read(result.parts[1]);
    // 正立化により縦長比がほぼ元の矩形（220/500=0.44）に回復する
    const ratio = tilted.bitmap.width / tilted.bitmap.height;
    assert.isBelow(ratio, 0.62);
    // 直立側はほぼ元の比率のまま（200/400=0.5）
    const ratio2 = upright.bitmap.width / upright.bitmap.height;
    assert.isBelow(ratio2, 0.7);
  });

  it('接触した矩形（橋渡し接続）はerode救済で分離される', async () => {
    // 上下2つの矩形が3pxの隙間（closingで橋渡しされる）で接続している
    const buf = await makeImage(800, 900, [
      [ 150, 100, 300, 250, 0xf8f8f8ff ],
      [ 100, 352, 340, 300, 0xf5f5f5ff ],
      [ 520, 560, 200, 250, 0xf0f0f0ff ]
    ]);
    const result = await splitImage(buf, 'image/png');
    assert.isNotNull(result);
    assert.equal(result.parts.length, 2);
  });
});
