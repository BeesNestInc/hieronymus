// 「精算書」の取引文書化:
// - TransactionKindsに「精算書」種別を追加（経費精算書からの連携専用。
//   hasDetails=false, hasDocument=0: 取引管理上はリンクとサマリだけ）
// - TransactionKinds.linked: 連携専用種別の印。手動作成の種別selectから除外する
// - TransactionDocuments.expenseReportId: 元の経費精算書への紐付け（1:1）
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TransactionKinds', 'linked', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('TransactionDocuments', 'expenseReportId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      unique: true
    });
    // 重複ガード: 既に「精算書」がある環境では足さない
    const existing = await queryInterface.sequelize.query(
      "select id from \"TransactionKinds\" where label = '精算書' limit 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT });
    if ( existing.length === 0 ) {
      await queryInterface.bulkInsert('TransactionKinds', [ {
        label: '精算書',
        displayOrder: 7,
        hasDetails: false,
        hasDocument: 0,
        forCompany: false,
        forBook: false,
        linked: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } ]);
    }
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "delete from \"TransactionKinds\" where label = '精算書' and linked = true");
    await queryInterface.removeColumn('TransactionDocuments', 'expenseReportId');
    await queryInterface.removeColumn('TransactionKinds', 'linked');
  }
};
