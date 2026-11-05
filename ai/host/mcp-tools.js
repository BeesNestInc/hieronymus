// voucher-mcp / expense-mcp（ai/mcp/）を engine hooks の mcpTools 形
// （群名 → ai-sdk Tool）にラップする。manifest は useMcp: ['voucher', 'expense']
// でツールを使える。HTTP API 経由で動作中の Hieronymus に接続する
// （client.js。HIERONYMUS_LOGIN_USER / PASSWORD が必要。HIERONYMUS_READONLY=1 で
// 書き込み無効）。
import { toolDefinitions as voucherDefs } from '../mcp/voucher-mcp/definitions.js';
import { handlers as voucherHandlers } from '../mcp/voucher-mcp/handlers.js';
import { toolDefinitions as expenseDefs } from '../mcp/expense-mcp/definitions.js';
import { handlers as expenseHandlers } from '../mcp/expense-mcp/handlers.js';

const wrapTools = (defs, handlers) => {
  const tools = {};
  for ( const def of defs ) {
    // inputSchema は生の JSON Schema（engine の sanitizeToolSchema が受ける）。
    // execute の応答は MCP の CallToolResult（{content:[...]}, isError）を
    // 素通しする（engine の wrapMemoryTools が dedupe/呼び出し上限を掛ける）
    tools[def.name] = {
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (args) => ( handlers[def.name](args || {}) )
    };
  }
  return tools;
};

export const kaikeiMcpTools = () => ({
  voucher: wrapTools(voucherDefs, voucherHandlers),
  expense: wrapTools(expenseDefs, expenseHandlers)
});
