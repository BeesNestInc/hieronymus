import fs from 'fs';
import path from 'path';
import models from '../models/index.js';

// AIプロンプトの世代管理（DB）とランタイムへのマテリアライズ。
// manifest-engine はDBを知らない汎用パッケージなので、こちらが
// TEMPLATE_DIR（runtime/prompt-templates）にアクティブな本文を
// 書き出して供給する。DBに行が無いキーはビルトイン（ai/prompt-templates）。

// 用途キーと表示名。ai/prompt-templates/*.md の一覧と一致させる
export const PROMPT_KEYS = [
  { key: 'ocr-statement',      title: '計算書読み取り' },
  { key: 'ocr-voucher',        title: '証憑OCR' },
  { key: 'statement-profile',  title: '取込プロファイル起草' },
  { key: 'rule-accounts',      title: '仕分け候補提案' },
  { key: 'draft-voucher-slip', title: '伝票下書き起草' },
  { key: 'reflect-voucher',    title: '伝票振り返り' },
  { key: 'standard',           title: '共通ペルソナ・ポリシー' }
];

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RUNTIME_DIR = path.join(projectRoot, 'runtime', 'prompt-templates');
const BUILTIN_DIR = path.join(projectRoot, 'ai', 'prompt-templates');

const builtinBody = (key) => {
  return fs.readFileSync(path.join(BUILTIN_DIR, `${key}.md`), 'utf-8');
};

// 現在の本文を解決する: DBの現世代 → ビルトイン
export const getActive = async (key) => {
  let body = null;
  let generation = null;
  try {
    const row = await models.PromptTemplateVersion.findOne({
      where: { key: key },
      order: [[ 'generation', 'DESC' ]]
    });
    if ( row ) {
      body = row.body;
      generation = row.generation;
    }
  } catch (e) {
    console.log('prompt lookup failed', e.message);
  }
  if ( body === null ) {
    body = builtinBody(key);
  }
  return { key: key, body: body, generation: generation, builtin: builtinBody(key) };
};

// 全用途の一覧（現世代・改変有無・履歴）
export const listPrompts = async () => {
  const out = [];
  for ( const { key, title } of PROMPT_KEYS ) {
    const active = await getActive(key);
    const versions = await models.PromptTemplateVersion.findAll({
      where: { key: key },
      attributes: [ 'generation', 'createdAt', 'createdBy' ],
      order: [[ 'generation', 'DESC' ]],
      raw: true
    });
    out.push({
      key: key,
      title: title,
      generation: active.generation,
      body: active.body,
      modified: Boolean(active.generation !== null),
      builtin: active.builtin,
      versions: versions
    });
  }
  return out;
};

// DB/ビルトインの現在状態をruntimeに反映する（起動時と更新後に呼ぶ。
// manifest-engine は TEMPLATE_DIR から readFileSync で読むので、ここに
// 現行の本文を書き出して供給する（engine自体は無改修）
export const materializeActive = async (key = null) => {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const keys = key ? [ key ] : PROMPT_KEYS.map((p) => p.key);
  for ( const k of keys ) {
    if ( !PROMPT_KEYS.some((p) => p.key === k) ) continue;
    const active = await getActive(k);
    fs.writeFileSync(path.join(RUNTIME_DIR, `${k}.md`), active.body, 'utf-8');
  }
};

// 保存: bodyを新世代として積み、runtimeに反映する
export const savePrompt = async (key, body, user) => {
  if ( !PROMPT_KEYS.some((p) => p.key === key) ) {
    const err = new Error(`不明な用途キーです: ${key}`);
    err.name = 'PromptError';
    throw err;
  }
  if ( ( !body ) || ( typeof body !== 'string' ) || ( body.trim().length === 0 ) ) {
    const err = new Error('本文が空です。');
    err.name = 'PromptError';
    throw err;
  }
  const last = await models.PromptTemplateVersion.findOne({
    where: { key: key },
    order: [[ 'generation', 'DESC' ]]
  });
  const generation = ( ( last && last.generation ) || 0 ) + 1;
  await models.PromptTemplateVersion.create({
    key: key,
    generation: generation,
    body: body,
    createdBy: ( user && user.id ) || null,
    createdAt: new Date()
  });
  await materializeActive(key);
  return { key: key, generation: generation };
};

// ロールバック: 指定世代の本文を新世代にコピーする（履歴は残る）
export const rollbackPrompt = async (key, generation, user) => {
  const row = await models.PromptTemplateVersion.findOne({
    where: { key: key, generation: Number(generation) }
  });
  if ( !row ) {
    const err = new Error(`指定された世代がありません: ${generation}`);
    err.name = 'PromptError';
    throw err;
  }
  return await savePrompt(key, row.body, user);
};

// ビルトインに戻す: ビルトイン本文を新世代として積む（フォールバック
// ではなく明示的に積むので履歴が残る）
export const resetPrompt = async (key, user) => {
  return await savePrompt(key, builtinBody(key), user);
};
