'use strict';

// 口座（Financial）テーブルの導入。
// - 銀行通帳 = 勘定科目(101系)+銀行補助
// - 法人カード = 未払金(203系)+カード補助（プロファイル paymentSubAccount）
// - 個人カード = 仮払金(113系)+立替者補助（memberの氏名から照合）
// 既存の statements / rules を口座に紐付ける（bank-statement.account+subAccount
// が口座の正体という、これまでの暗黙を明示化する）。
// VoucherClass「カード明細」（証憑化で使う。無ければ作る）もここで用意する

module.exports = {
  async up (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // 1) テーブル
      await queryInterface.createTable('Financials', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        name: { type: Sequelize.STRING },
        kind: { type: Sequelize.STRING },
        accountCode: { type: Sequelize.STRING },
        subAccountCode: { type: Sequelize.INTEGER },
        memberId: { type: Sequelize.INTEGER },
        profileName: { type: Sequelize.STRING },
        closedAt: { type: Sequelize.DATE },
        memo: { type: Sequelize.TEXT },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      }, { transaction: t });
      await queryInterface.addConstraint('Financials', {
        fields: [ 'accountCode', 'subAccountCode' ],
        type: 'unique',
        name: 'Financials_account_sub_unique',
        transaction: t
      });

      // 2) statements に financialId を足す
      await queryInterface.addColumn('BankStatements', 'financialId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Financials', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });

      // 3) 既存 statements から口座を作って紐付ける
      await queryInterface.sequelize.query(`
        SELECT s.id, s."kind", s."account", s."subAccount", s."cardName", s."memberId", s."profileName"
        FROM "BankStatements" s
      `, { transaction: t, type: queryInterface.sequelize.QueryTypes.SELECT });

      const statements = await queryInterface.sequelize.query(
        `SELECT id, kind, account, "subAccount", "cardName", "memberId", "profileName" FROM "BankStatements"`,
        { transaction: t, type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      // プロファイルの引落科目（カード系のaccountがnullの行の解決に使う）
      const fs = await import('fs');
      const path = await import('path');
      const yaml = await import('js-yaml');
      const dir = process.env.BANK_CONFIG_PATH || 'config/banks';
      const profiles = [];
      try {
        for ( const name of fs.readdirSync(dir) ) {
          if ( !/\.ya?ml$/i.test(name) || name.endsWith('.sample') ) {
            continue;
          }
          try {
            const profile = yaml.load(fs.readFileSync(path.join(dir, name), 'utf-8'));
            if ( profile && profile.name && ( profile.type === 'card' ) ) {
              profiles.push(profile);
            }
          } catch (e) {
            // 読めないプロファイルは無視
          }
        }
      } catch (e) {
        // ディレクトリがなければプロファイルなし
      }
      const financialByKey = new Map();
      for ( const s of statements ) {
        let accountCode = s.account;
        let subAccountCode = s.subAccount;
        let kind = s.kind;
        let profileName = s.profileName;
        let name = null;
        let memberId = null;
        if ( kind === 'corporate_card' ) {
          const profile = profiles.find((p) => ( p.cardName === s.cardName )) ||
            profiles.find((p) => ( p.name === s.profileName || p.name === s.cardName ));
          if ( profile ) {
            accountCode = profile.paymentAccount || '2030000';
            subAccountCode = profile.paymentSubAccount || null;
            profileName = profile.name;
            name = profile.name;
          } else {
            accountCode = '2030000';
            name = s.cardName;
          }
        } else if ( kind === 'personal_card' ) {
          accountCode = '1130000';
          memberId = s.memberId;
          // 立替者補助の照合（memberの氏名から。1回だけの移行なので آمی近似照合を許す）
          const subs = await queryInterface.sequelize.query(
            `SELECT su."subAccountCode", su."name" FROM "SubAccounts" su
             JOIN "Accounts" a ON a.id = su."accountId"
             WHERE a."accountCode" = '1130000'`,
            { transaction: t, type: queryInterface.sequelize.QueryTypes.SELECT }
          );
          if ( memberId ) {
            const user = ( await queryInterface.sequelize.query(
              `SELECT u.id, m."tradingName", m."legalName" FROM "Users" u
               JOIN "Members" m ON m."userId" = u.id WHERE u.id = :memberId`,
              { transaction: t, replacements: { memberId: memberId }, type: queryInterface.sequelize.QueryTypes.SELECT }
            ) )[0];
            if ( user ) {
              const names = [ user.tradingName, user.legalName ].filter(( n ) => n);
              for ( const name2 of names ) {
                const sub = subs.find(( su ) => ( su.name === name2 )) ||
                  subs.find(( su ) => ( su.name === `${name2}氏` )) ||
                  subs.find(( su ) => ( su.name && ( name2.includes(su.name) || su.name.includes(name2) ) ));
                if ( sub ) {
                  subAccountCode = sub.subAccountCode;
                  name = sub.name;
                  break;
                }
              }
            }
          }
        }
        if ( !accountCode ) {
          // 口座未設定の取込（銀行取り込後に口座を設定する運用）。口座は作れないのでそのまま
          continue;
        }
        const key = `${accountCode}|${subAccountCode || ''}`;
        let financial = financialByKey.get(key);
        if ( !financial ) {
          const subs = ( subAccountCode ) ?
            ( await queryInterface.sequelize.query(
              `SELECT su."name" FROM "SubAccounts" su JOIN "Accounts" a ON a.id = su."accountId"
               WHERE a."accountCode" = :accountCode AND su."subAccountCode" = :subAccountCode`,
              { transaction: t, replacements: { accountCode: accountCode, subAccountCode: subAccountCode },
                type: queryInterface.sequelize.QueryTypes.SELECT }
            ) ) : [];
          const displayName = name || ( ( subs.length > 0 ) ? subs[0].name : accountCode );
          const rows = await queryInterface.sequelize.query(
            `INSERT INTO "Financials" ("name", "kind", "accountCode", "subAccountCode", "memberId", "profileName", "createdAt", "updatedAt")
             VALUES (:name, :kind, :accountCode, :subAccountCode, :memberId, :profileName, NOW(), NOW())
             ON CONFLICT ("accountCode", "subAccountCode") DO UPDATE SET "updatedAt" = NOW()
             RETURNING id`,
            { transaction: t, replacements: {
              name: displayName, kind: kind,
              accountCode: accountCode, subAccountCode: subAccountCode,
              memberId: memberId, profileName: profileName
            }, type: queryInterface.sequelize.QueryTypes.SELECT }
          );
          financial = rows[0];
          financialByKey.set(key, financial);
        }
        await queryInterface.sequelize.query(
          `UPDATE "BankStatements" SET "financialId" = :financialId WHERE id = :id`,
          { transaction: t, replacements: { financialId: financial.id, id: s.id } }
        );
      }

      // 4) rules に financialId を足して紐付ける
      await queryInterface.addColumn('BankStatementRules', 'financialId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Financials', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });
      const rules = await queryInterface.sequelize.query(
        `SELECT id, account, "subAccount" FROM "BankStatementRules"`,
        { transaction: t, type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      for ( const rule of rules ) {
        const key = `${rule.account}|${rule.subAccount || ''}`;
        let financial = financialByKey.get(key);
        if ( !financial ) {
          const subs = ( rule.subAccount ) ?
            ( await queryInterface.sequelize.query(
              `SELECT su."name" FROM "SubAccounts" su JOIN "Accounts" a ON a.id = su."accountId"
               WHERE a."accountCode" = :accountCode AND su."subAccountCode" = :subAccountCode`,
              { transaction: t, replacements: { accountCode: rule.account, subAccountCode: rule.subAccount },
                type: queryInterface.sequelize.QueryTypes.SELECT }
            ) ) : [];
          const kind = ( /^101/.test(rule.account || '') ) ? 'bank' :
            ( /^113/.test(rule.account || '') ) ? 'personal_card' :
            ( /^203/.test(rule.account || '') ) ? 'corporate_card' : 'bank';
          const rows = await queryInterface.sequelize.query(
            `INSERT INTO "Financials" ("name", "kind", "accountCode", "subAccountCode", "createdAt", "updatedAt")
             VALUES (:name, :kind, :accountCode, :subAccountCode, NOW(), NOW())
             ON CONFLICT ("accountCode", "subAccountCode") DO UPDATE SET "updatedAt" = NOW()
             RETURNING id`,
            { transaction: t, replacements: {
              name: ( subs.length > 0 ) ? subs[0].name : rule.account,
              kind: kind,
              accountCode: rule.account,
              subAccountCode: rule.subAccount
            }, type: queryInterface.sequelize.QueryTypes.SELECT }
          );
          financial = rows[0];
          financialByKey.set(key, financial);
        }
        await queryInterface.sequelize.query(
          `UPDATE "BankStatementRules" SET "financialId" = :financialId WHERE id = :id`,
          { transaction: t, replacements: { financialId: financial.id, id: rule.id } }
        );
      }

      // 5) rules の旧キー（account）はnullableにする（照合はfinancialId方向へ全替え）
      await queryInterface.changeColumn('BankStatementRules', 'account', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction: t });
      await queryInterface.changeColumn('BankStatementRules', 'subAccount', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction: t });

      // 5) VoucherClass「カード明細」を用意する（証憑化で使う）
      await queryInterface.sequelize.query(
        `INSERT INTO "VoucherClasses" ("name", "displayOrder", "send", "form", "createdAt", "updatedAt")
         SELECT 'カード明細', 40, false, '', NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM "VoucherClasses" WHERE "name" = 'カード明細')`,
        { transaction: t }
      );

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down (queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('BankStatementRules', 'financialId', { transaction: t });
      await queryInterface.removeColumn('BankStatements', 'financialId', { transaction: t });
      await queryInterface.dropTable('Financials', { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }
};
