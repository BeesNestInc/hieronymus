// see https://zenn.dev/tatsuyasusukida/articles/sequelize-cjs-to-esm
import Account from './account.js';
import AccountClass from './accountclass.js';
import AccountRemaining from './accountremaining.js';
import CrossSlip from './crossslip.js';
import CrossSlipDetail from './crossslipdetail.js';
import Company from './company.js';
import CompanyClass from './company-class.js';
import Document from './document.js';
import DocumentFile from './document-file.js';
import FiscalYear from './fiscalyear.js';
import MonthlyLog from './monthlylog.js';
import Item from './item.js';
import ItemClass from './itemclass.js';
import ItemFile from './itemfile.js';
import Member from './member.js';
import MemberClass from './memberclass.js';
import Menu from './menu.js';
import Project from './project.js';
import Label from './label.js';
import ProjectLabel from './projectlabel.js';
import LabelAccount from './labelaccount.js';
import Sticky from './sticky.js';
import StickyStatus from './stickystatus.js';
import SubAccount from './subaccount.js';
import SubAccountRemaining from './subaccountremaining.js';
import Task from './task.js';
import TaskDetail from './task-detail.js';
import TaxRule from './tax-rule.js';
import TransactionDocument from './transaction-document.js';
import TransactionDetail from './transaction-detail.js';
import TransactionKind from './transaction-kind.js';
import User from './user.js';
import Voucher from './voucher.js';
import VoucherClass from './voucherclass.js';
import VoucherFile from './voucherfile.js';
import {Sequelize, DataTypes} from 'sequelize';
import fs from 'fs';

const env = process.env.NODE_ENV || 'development';

const jsonData = JSON.parse(fs.readFileSync('config/config.json', 'utf-8'));
const config = jsonData[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const models = {
  Account: Account(sequelize, DataTypes),
  AccountClass: AccountClass(sequelize, DataTypes),
  AccountRemaining: AccountRemaining(sequelize, DataTypes),
  CrossSlip: CrossSlip(sequelize, DataTypes),
  CrossSlipDetail: CrossSlipDetail(sequelize, DataTypes),
  Company: Company(sequelize, DataTypes),
  CompanyClass: CompanyClass(sequelize, DataTypes),
  Document: Document(sequelize, DataTypes),
  DocumentFile: DocumentFile(sequelize, DataTypes),
  FiscalYear: FiscalYear(sequelize, DataTypes),
  Item: Item(sequelize, DataTypes),
  ItemClass: ItemClass(sequelize, DataTypes),
  ItemFile: ItemFile(sequelize, DataTypes),
  Member: Member(sequelize, DataTypes),
  MemberClass: MemberClass(sequelize, DataTypes),
  Menu: Menu(sequelize, DataTypes),
  MonthlyLog: MonthlyLog(sequelize, DataTypes),
  Project: Project(sequelize, DataTypes),
  Label: Label(sequelize, DataTypes),
  ProjectLabel: ProjectLabel(sequelize, DataTypes),
  LabelAccount: LabelAccount(sequelize, DataTypes),
  Sticky: Sticky(sequelize, DataTypes),
  StickyStatus: StickyStatus(sequelize, DataTypes),
  SubAccount: SubAccount(sequelize, DataTypes),
  SubAccountRemaining: SubAccountRemaining(sequelize, DataTypes),
  Task: Task(sequelize, DataTypes),
  TaskDetail: TaskDetail(sequelize, DataTypes),
  TaxRule: TaxRule(sequelize, DataTypes),
  TransactionDocument: TransactionDocument(sequelize, DataTypes),
  TransactionDetail: TransactionDetail(sequelize, DataTypes),
  TransactionKind: TransactionKind(sequelize, DataTypes),
  User: User(sequelize, DataTypes),
  Voucher: Voucher(sequelize, DataTypes),
  VoucherClass: VoucherClass(sequelize, DataTypes),
  VoucherFile: VoucherFile(sequelize, DataTypes)
}

Object.keys(models).forEach(key => {
  if (models[key].associate) {
    models[key].associate(models)
  }
})

models.sequelize = sequelize;
models.Sequelize = Sequelize;

export default models;