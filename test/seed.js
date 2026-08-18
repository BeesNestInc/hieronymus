import models from '../models/index.js';
import bcrypt from 'bcrypt';

const findOrCreate = async (model, where, values) => {
  const existing = await model.findOne({ where: where });
  if ( existing ) {
    return existing;
  }
  return model.create(values);
};

const seed = async () => {
  const fy = await findOrCreate(models.FiscalYear, {
    term: 1
  }, {
    term: 1,
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    taxIncluded: false,
    transactionCount: 0
  });

  await findOrCreate(models.TaxRule, {
    label: '10%外税'
  }, {
    label: '10%外税',
    displayOrder: 1,
    taxClass: 2,
    rate: 10,
    startDate: null,
    endDate: null
  });

  const accountClass = await findOrCreate(models.AccountClass, {
    major: '1'
  }, {
    major: '1',
    middle: '100',
    minor: '1000',
    field: 1,
    adding: 0
  });

  const cash = await findOrCreate(models.Account, {
    accountCode: '1000001'
  }, {
    name: '現金',
    key: 'cash',
    accountClassId: accountClass.id,
    accountCode: '1000001',
    taxClass: 0,
    subAccountCount: 0
  });

  const expense = await findOrCreate(models.Account, {
    accountCode: '7000001'
  }, {
    name: '仕入',
    key: 'purchase',
    accountClassId: accountClass.id,
    accountCode: '7000001',
    taxClass: 2,
    subAccountCount: 0
  });

  const income = await findOrCreate(models.Account, {
    accountCode: '6000001'
  }, {
    name: '売上',
    key: 'sales',
    accountClassId: accountClass.id,
    accountCode: '6000001',
    taxClass: 2,
    subAccountCount: 0
  });

  const company = await findOrCreate(models.Company, {
    name: 'テスト取引先'
  }, {
    name: 'テスト取引先',
    key: 'test'
  });

  await findOrCreate(models.VoucherClass, {
    name: '仕入'
  }, {
    name: '仕入',
    displayOrder: 1,
    send: false,
    form: ''
  });

  const hashed = bcrypt.hashSync('secret', 10);

  const approver = await findOrCreate(models.User, {
    name: 'approver'
  }, {
    name: 'approver',
    hashPassword: hashed,
    accounting: true,
    approvable: true,
    fiscalBrowsing: true,
    administrable: false,
    companyManagement: false,
    inventoryManagement: false,
    personnelManagement: false
  });

  const creator = await findOrCreate(models.User, {
    name: 'creator'
  }, {
    name: 'creator',
    hashPassword: hashed,
    accounting: false,
    approvable: false,
    fiscalBrowsing: false,
    administrable: false,
    companyManagement: false,
    inventoryManagement: false,
    personnelManagement: false
  });

  return { fy, cash, expense, income, company, approver, creator };
};

export default seed;