import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const cookieJar = new CookieJar();
const baseURL = process.env.HIERONYMUS_BASE_URL || 'http://localhost:3010';

const http = wrapper(axios.create({
  baseURL: baseURL,
  headers: { 'Content-Type': 'application/json' },
  jar: cookieJar,
  withCredentials: true,
  timeout: 15000
}));

let loggedIn = false;

const ensureLogin = async () => {
  if ( loggedIn ) {
    return;
  }
  const user = process.env.HIERONYMUS_LOGIN_USER;
  const password = process.env.HIERONYMUS_LOGIN_PASSWORD;
  if ( !user || !password ) {
    throw new Error('HIERONYMUS_LOGIN_USER / HIERONYMUS_LOGIN_PASSWORD が未設定です');
  }
  const res = await http.post('/api/user/login', { user_name: user, password });
  if ( res.data.result !== 'OK' ) {
    throw new Error(`ログインに失敗しました: ${res.data.message || 'unknown'}`);
  }
  loggedIn = true;
};

const unwrap = (data) => {
  if ( data && (typeof data.code === 'number') && (data.code !== 0) ) {
    throw new Error(data.message || `API error code=${data.code}`);
  }
  return data;
};

const get = async (path, params) => {
  await ensureLogin();
  const res = await http.get(path, { params: params });
  return unwrap(res.data);
};

const post = async (path, body) => {
  await ensureLogin();
  const res = await http.post(path, body);
  return unwrap(res.data);
};

const put = async (path, body) => {
  await ensureLogin();
  const res = await http.put(path, body);
  return unwrap(res.data);
};

const del = async (path, body) => {
  await ensureLogin();
  const res = await http.delete(path, { data: body });
  return unwrap(res.data);
};

const upload = async (apiPath, filePath) => {
  await ensureLogin();
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer]), path.basename(filePath));
  const res = await http.post(apiPath, form, {
    headers: { 'Content-Type': undefined }
  });
  return unwrap(res.data);
};

export const api = {
  getCompanyInfo: () => get('/api/company/info'),
  getAccounts: () => get('/api/accounts'),
  getCompanies: () => get('/api/company'),
  getVoucherClasses: () => get('/api/voucher/classes'),
  getTaxRules: (date) => get('/api/tax-rule', { type: 'active', date: date }),
  getFiscalYear: (year, month) => get(`/api/term/${year}/${month}`),
  getJournal: (year, month) => get(`/api/journal/${year}/${month}`),
  getCrossSlip: (year, month, no) => get(`/api/cross_slip/${year}/${month}/${no}`),
  listCrossSlips: (type) => get(`/api/cross_slips/${type || 'not_approved'}`),
  listVouchers: (params) => get('/api/voucher', params),
  createCrossSlip: (body) => post('/api/cross_slip', body),
  updateCrossSlip: (body) => put('/api/cross_slip', body),
  approve: (body) => put('/api/cross_slip/approve', body),
  deleteCrossSlip: (body) => del('/api/cross_slip', body),
  createVoucher: (body) => post('/api/voucher', body),
  uploadVoucherFile: (id, filePath) => upload(`/api/voucher/upload/${id}`, filePath),
  updateVoucher: (body) => put('/api/voucher', body),
  deleteVoucher: (body) => del('/api/voucher', body)
};

export default api;