'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
/*
*/
    await queryInterface.addColumn('TransactionDetails', 'taxRuleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'TaxRules',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT'
    });
    await queryInterface.addColumn('TransactionDetails', 'tax', {
      type: Sequelize.DECIMAL(12),
      allowNull: true
    });
    await queryInterface.addColumn('TaskDetails', 'taxRuleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'TaxRules',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT'
    });
    await queryInterface.addColumn('TaskDetails', 'tax', {
      type: Sequelize.DECIMAL(12),
      allowNull: true
    });
    await queryInterface.removeColumn('Tasks', 'taxClass');
    await queryInterface.removeColumn('TransactionDocuments', 'taxClass');
    await queryInterface.removeConstraint('TransactionDocuments', 'TransactionDocuments_documentId_fkey');
    await queryInterface.addConstraint('TransactionDocuments', {
      fields: ['documentId'],
      type: 'foreign key',
      name: 'TransactionDocuments_documentId_fkey',
      references: {
        table: 'Documents',
        field: 'id'
      },
    })

    await queryInterface.removeConstraint('TransactionDetails', 'TransactionDetails_transactionDocumentId_fkey');
    await queryInterface.addConstraint('TransactionDetails', {
      fields: ['transactionDocumentId'],
      type: 'foreign key',
      name: 'TransactionDetails_transactionDocumentId_fkey',
      references: {
        table: 'TransactionDocuments',
        field: 'id'
      },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('TransactionDetails', 'TransactionDetails_taxRuleId_fkey');
    await queryInterface.removeConstraint('TaskDetails', 'TaskDetails_taxRuleId_fkey');
    await queryInterface.removeColumn('TransactionDetails', 'taxRuleId');
    await queryInterface.removeColumn('TransactionDetails', 'tax');
    await queryInterface.removeColumn('TaskDetails', 'taxRuleId');
    await queryInterface.removeColumn('TaskDetails', 'tax');
    await queryInterface.addColumn('Tasks', 'taxClass', {
      type: Sequelize.INTEGER
    });
    await queryInterface.addColumn('TransactionDocuments', 'taxClass', {
      type: Sequelize.INTEGER
    });
  }
};
