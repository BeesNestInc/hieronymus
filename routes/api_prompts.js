import models from '../models/index.js';
import {
  PROMPT_KEYS, listPrompts, getActive, savePrompt, rollbackPrompt, resetPrompt,
  setGenerationMemo, deleteGeneration
} from '../libs/ai-prompts.js';

// AI管理権限（aiManage）向け: プロンプトの世代管理。
// 全操作がaiManage。用途キーはai/promptsの8本（standard含む）。

export default {
  // 一覧: 用途・現generation・改変有無・履歴・ビルトイン
  list: async (req, res, next) => {
    try {
      res.json({ code: 0, prompts: await listPrompts() });
    } catch (e) {
      console.log(e);
      res.status(500).json({ code: -1, message: 'プロンプト一覧の取得に失敗しました。' });
    }
  },

  // 単一: 現body + 履歴 + ビルトイン
  get: async (req, res, next) => {
    const key = String(req.params.key || '');
    if ( !PROMPT_KEYS.some((p) => ( p.key === key )) ) {
      res.json({ code: -1, message: '不明な用途キーです。' });
      return;
    }
    try {
      const versions = await models.PromptTemplateVersion.findAll({
        where: { key: key },
        attributes: [ 'generation', 'createdAt', 'createdBy' ],
        order: [[ 'generation', 'DESC' ]],
        raw: true
      });
      res.json({
        code: 0,
        prompt: await getActive(key),
        versions: versions
      });
    } catch (e) {
      console.log(e);
      res.status(500).json({ code: -1, message: 'プロンプトの取得に失敗しました。' });
    }
  },

  // 保存: 新世代として積む（ロールバック可能）
  save: async (req, res, next) => {
    try {
      const result = await savePrompt(String(req.params.key), ( req.body || {} ).body, req.session.user, ( req.body || {} ).memo || null);
      res.json({ code: 0, prompt: result });
    } catch (e) {
      res.status(422).json({ code: -1, message: e.message || 'プロンプトの保存に失敗しました。' });
    }
  },

  // ロールバック: 指定世代の本文を新世代にコピーする
  rollback: async (req, res, next) => {
    try {
      const generation = parseInt(( req.body || {} ).generation);
      if ( !generation ) {
        res.status(422).json({ code: -1, message: '世代が指定されていません。' });
        return;
      }
      const result = await rollbackPrompt(String(req.params.key), generation, req.session.user, ( req.body || {} ).memo || null);
      res.json({ code: 0, prompt: result });
    } catch (e) {
      res.status(422).json({ code: -1, message: e.message || 'ロールバックに失敗しました。' });
    }
  },

  // 世代の説明を更新する
  memo: async (req, res, next) => {
    try {
      const generation = parseInt(( req.body || {} ).generation);
      const memo = ( req.body || {} ).memo;
      const result = await setGenerationMemo(String(req.params.key), generation, memo, req.session.user);
      res.json({ code: 0, prompt: result });
    } catch (e) {
      res.status(422).json({ code: -1, message: e.message || '説明の更新に失敗しました。' });
    }
  },

  // 世代を削除する（現世代の削除時は残った最大世代が現世代になる）
  deleteGeneration: async (req, res, next) => {
    try {
      const result = await deleteGeneration(String(req.params.key), parseInt(req.params.generation));
      res.json({ code: 0, prompt: result });
    } catch (e) {
      res.status(422).json({ code: -1, message: e.message || '世代の削除に失敗しました。' });
    }
  },

  // ビルトインに戻す: ビルトイン本文を新世代として積む（履歴は残る）
  reset: async (req, res, next) => {
    try {
      const result = await resetPrompt(String(req.params.key), req.session.user);
      res.json({ code: 0, prompt: result });
    } catch (e) {
      res.status(422).json({ code: -1, message: e.message || 'ビルトインへの復元に失敗しました。' });
    }
  }
};
