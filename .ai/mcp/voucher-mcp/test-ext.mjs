import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const env = {
  ...process.env,
  HIERONYMUS_BASE_URL: 'http://localhost:3101',
  HIERONYMUS_LOGIN_USER: process.env.MCP_USER || 'creator',
  HIERONYMUS_LOGIN_PASSWORD: 'secret'
};
const transport = new StdioClientTransport({
  command: 'node',
  args: ['index.js'],
  cwd: '/home/ogochan/git/hieronymus.main/.ai/mcp/voucher-mcp',
  env,
  stderr: process.stderr,
});
const client = new Client({ name: 'voucher-ext-test', version: '0.1.0' });
await client.connect(transport);

const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const txt = res.content && res.content[0] ? res.content[0].text : '';
  console.log(`\n== ${name} ${res.isError ? '[ERROR]' : '[OK]'} ==`);
  console.log(txt.slice(0, 800));
  return res;
};

const tools = await client.listTools();
console.log('tools:', tools.tools.map((t) => t.name).join(', '));

await call('get_journal', { year: 2026, month: 3 });
await call('create_voucher_with_file', {
  voucherClassId: 1,
  issueDate: '2026-03-25',
  companyId: 1,
  amount: 5000,
  taxRuleId: 7,
  filePath: '/home/ogochan/git/hieronymus.main/見積書テスト.pdf',
  description: 'file upload test'
});
await call('list_vouchers', { date: '2026-03-25' });

await client.close();
process.exit(0);