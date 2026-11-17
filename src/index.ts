import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerChangeTools } from "./tools/change.js";
import { registerTickTools } from "./tools/tick.js";
import { registerOkrTools } from "./tools/okr.js";
import { registerVaultTools } from "./tools/vault.js";
import { registerCrossAppTools } from "./tools/cross-app.js";

const server = new McpServer({
  name: "sos-business-suite",
  version: "1.0.0",
});

// Register all tool modules
registerChangeTools(server);
registerTickTools(server);
registerOkrTools(server);
registerVaultTools(server);
registerCrossAppTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ship or Sink MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
