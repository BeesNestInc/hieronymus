// クレデンシャルは親プロセスの env か cwd の .env から（Legion の .env に HIERONYMUS_LOGIN_* を書くと
// この MCP を設定者の知らないパスワードを yaml に書かずに使える）
import 'dotenv/config';
import axios from 'axios';
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

export const api = {
  listExpenseMappings: () => get('/api/expense_mapping'),
  createExpenseMapping: (body) => put('/api/expense_mapping', { values: [body] }),
  updateExpenseMapping: (body) => put('/api/expense_mapping', { values: [body] }),
  deleteExpenseMapping: (id) => put('/api/expense_mapping', { values: [{ id: id }] }),
  listExpenseReports: (type) => get(type ? `/api/expense_reports/${type}` : '/api/expense_reports'),
  getExpenseReport: (id) => get(`/api/expense_report/${id}`),
  updateExpenseReport: (body) => put('/api/expense_report', body)
};

export default api;
