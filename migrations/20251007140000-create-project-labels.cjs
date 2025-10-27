'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Labelsテーブル
    await queryInterface.createTable('Labels', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      description: {
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

    // ProjectLabelsテーブル
    await queryInterface.createTable('ProjectLabels', {
      projectId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'Projects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      labelId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'Labels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    // LabelAccountsテーブル
    await queryInterface.createTable('LabelAccounts', {
      labelId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'Labels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      accountCode: {
        type: Sequelize.STRING,
        primaryKey: true
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

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('LabelAccounts');
    await queryInterface.dropTable('ProjectLabels');
    await queryInterface.dropTable('Labels');
  }
};
