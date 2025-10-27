'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('ProjectLabels', 'displayOrder', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('ProjectLabels', 'displayOrder');
  }
};
