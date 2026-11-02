'use strict';

// 学習ルールに「合流」「突合許可」のフラグを持たせる。
// これまで取込設定（config/banks/merge-rules.yaml / match-rules.yaml）で
// 口座共通に管理していた2つの「お約束」を、口座単位のルールに統合する:
// - merge: この摘要の行は「前の行（同じ日）の伝票」に合流する
// - match: この摘要の行は「既存仕訳との突合」「後の処理」で自動結合してよい
// 既存の口座には、yamlの内容をルールとして種まきする（挙動を維持）。
// 相手方を持つ既存ルール（例: 振込手数料→支払手数料7030110）はそのルールに
// mergeを立てるだけで、合流行が正科目で起票されるようになる

const MERGE_SEED = [ '手数料', '振込手数料', 'ATM手数料' ];

module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('BankStatementRules', 'merge', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction: t });
      await queryInterface.addColumn('BankStatementRules', 'match', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction: t });
      // 合流/突合専用のルール（相手方なし=仮入科目扱い）を持てるようにする
      await queryInterface.changeColumn('BankStatementRules', 'oppositeAccount', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction: t });
      await queryInterface.changeColumn('BankStatementRules', 'oppositeSubAccount', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction: t });

      // yamlの合流摘要を、全口座に対してルールとして種まきする
      // （既存の同摘要ルールがあれば merge を立てるだけ）
      const financials = await queryInterface.sequelize.query(
        'SELECT id FROM "Financials"',
        { transaction: t, type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for ( const financial of financials ) {
        for ( const pattern of MERGE_SEED ) {
          const existing = await queryInterface.sequelize.query(
            'SELECT id FROM "BankStatementRules" WHERE "financialId" = :fid AND "pattern" = :pattern LIMIT 1',
            { transaction: t, replacements: { fid: financial.id, pattern: pattern },
              type: queryInterface.sequelize.QueryTypes.SELECT }
          );
          if ( existing.length > 0 ) {
            await queryInterface.sequelize.query(
              'UPDATE "BankStatementRules" SET "merge" = true WHERE id = :id',
              { transaction: t, replacements: { id: existing[0].id } }
            );
          } else {
            // 相手方なし（仮入科目で載る）。口座ごとに後で科目を足せる
            await queryInterface.sequelize.query(
              `INSERT INTO "BankStatementRules"
               ("financialId", "pattern", "direction", "merge", "match", "usageCount", "createdAt", "updatedAt")
               VALUES (:fid, :pattern, NULL, true, false, 0, NOW(), NOW())`,
              { transaction: t, replacements: { fid: financial.id, pattern: pattern } }
            );
          }
        }
      }
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down (queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('BankStatementRules', 'merge', { transaction: t });
      await queryInterface.removeColumn('BankStatementRules', 'match', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
