// 通帳取込行に伝票への直リンク（crossSlipId）を追加する。
// 明細へのリンク（crossSlipDetailId）は伝票保存時の明細の作り直しで
// idが変わるため切れるが、伝票リンクは保存しても安定する。
// （伝票の「完成させた保存」で取込行が未照合に戻る問題の解決）
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('BankStatementLines', 'crossSlipId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    // 既存データのバックフィル（明細経由で伝票を引く）
    await queryInterface.sequelize.query(`
      UPDATE "BankStatementLines" l
      SET "crossSlipId" = d."crossSlipId"
      FROM "CrossSlipDetails" d
      WHERE l."crossSlipDetailId" = d.id
    `);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('BankStatementLines', 'crossSlipId');
  }
};
