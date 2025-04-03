'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Stickies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      authorId: {
        type: Sequelize.INTEGER
      },
      message: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('StickyStatuses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      stickyId: {
        type: Sequelize.INTEGER
      },
      receiverId: {
        type: Sequelize.INTEGER
      },
      showHide: {
        type: Sequelize.BOOLEAN
      },
      importance: {
        type: Sequelize.INTEGER
      },
      posX: {
        type: Sequelize.INTEGER
      },
      posY: {
        type: Sequelize.INTEGER
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Stickies');
    await queryInterface.dropTable('StickyStatuses');
  }
};