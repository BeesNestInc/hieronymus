'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('LabelAccounts', 'summaryType', {
      type: Sequelize.DataTypes.STRING,
      allowNull: false,
      defaultValue: 'credit'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('LabelAccounts', 'summaryType');
  }
};