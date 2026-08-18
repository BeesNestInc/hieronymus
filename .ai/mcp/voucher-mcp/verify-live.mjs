import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const raw = fs.readFileSync(process.env.HOME + '/.config/opencode/opencode.json', 'utf-8');
const grab = (k) => {
  const m = raw.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`));
  return m ? m[1] : undefined;
};
const env = {
  HIERONYMUS_BASE_URL: grab('HIERONYMUS_BASE_URL'),
  HIERONYMUS_LOGIN_USER: grab('HIERONYMUS_LOGIN_USER'),
  HIERONYMUS_LOGIN_PASSWORD: grab('HIERONYMUS_LOGIN_PASSWORD')
};

const transport = new StdioClientTransport({
  command: 'node',
  args: ['index.js'],
  cwd: '/home/ogochan/git/hieronymus.main/.ai/mcp/voucher-mcp',
  env: { ...process.env, ...env },
  stderr: process.stderr,
});
const client = new Client({ name: 'verify-live', version: '0.1.0' });
await client.connect(transport);
const tools = await client.listTools();
console.log('connected tools:', tools.tools.length);
for (const t of ['get_fiscal_year', 'get_voucher_classes', 'get_companies']) {
  const res = await client.callTool({ name: t, arguments: t === 'get_fiscal_year' ? { year: 2026, month: 8 } : {} });
  console.log(`== ${t} ==`, res.isError ? '[ERROR]' : '[OK]', (res.content[0]?.text || '').slice(0, 200));
}
await client.close();
process.exit(0);
