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
});
