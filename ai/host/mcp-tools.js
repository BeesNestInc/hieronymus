// voucher-mcp / expense-mcpを engine hooks の mcpTools 形（群名 → ai-sdk Tool）
// にラップする。manifest は useMcp: ['voucher', 'expense'] でツールを使える。
// HTTP API 経由で動作中の Hieronymus に接続する（client.js。HIERONYMUS_LOGIN_USER /
// PASSWORD が必要。HIERONYMUS_READONLY=1 で書き込み無効）。
import { jsonSchema } from 'ai';
import { toolDefinitions as voucherDefs } from '../mcp/voucher-mcp/definitions.js';
import { handlers as voucherHandlers } from '../mcp/voucher-mcp/handlers.js';
import { toolDefinitions as expenseDefs } from '../mcp/expense-mcp/definitions.js';
import { handlers as expenseHandlers } from '../mcp/expense-mcp/handlers.js';

const wrapTools = (defs, handlers) => {
  const tools = {};
  for ( const def of defs ) {
    // inputSchema は ai-sdk に受ける形で渡す。生の JSON Schema オブジェクトでは
    // ai-sdk の asSchema が落ちる（zod または jsonSchema() で支援）。
    // execute の応答は MCP の CallToolResult（{content:[...]}, isError）を
    // 素通しする（engine の wrapMemoryTools が dedupe/呼び出し上限を掛ける）
    tools[def.name] = {
      description: def.description,
      inputSchema: jsonSchema(def.inputSchema),
      execute: async (args) => ( handlers[def.name](args || {}) )
    };
  }
  return tools;
};

export const kaikeiMcpTools = () => ({
  voucher: wrapTools(voucherDefs, voucherHandlers),
  expense: wrapTools(expenseDefs, expenseHandlers)
});
