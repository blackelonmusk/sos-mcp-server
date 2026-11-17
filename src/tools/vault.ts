import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { USER_ID } from "../types.js";

export function registerVaultTools(server: McpServer) {
  // ── Read Tools ──

  server.tool("vault_get_folders", "List all Vault folders", {}, async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*, documents(count)")
      .eq("user_id", USER_ID)
      .order("name");

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("vault_get_documents", "List documents, optionally filtered by folder", {
    folderId: z.string().optional().describe("Filter by folder ID"),
  }, async ({ folderId }) => {
    let query = supabase
      .from("documents")
      .select("id, title, folder_id, created_at, updated_at")
      .eq("user_id", USER_ID);

    if (folderId) query = query.eq("folder_id", folderId);

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("vault_get_document", "Get a document with its full content", {
    id: z.string().describe("Document ID"),
  }, async ({ id }) => {
    const { data, error } = await supabase
      .from("documents")
      .select("*, folders(name)")
      .eq("id", id)
      .eq("user_id", USER_ID)
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("vault_search", "Search documents by title or content", {
    query: z.string().describe("Search query"),
  }, async ({ query }) => {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, folder_id, created_at, updated_at")
      .eq("user_id", USER_ID)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  // ── Write Tools ──

  server.tool("vault_create_document", "Create a new document in Vault", {
    title: z.string().describe("Document title"),
    content: z.string().describe("Document content (markdown supported)"),
    folderId: z.string().optional().describe("Folder ID to place the document in"),
  }, async ({ title, content, folderId }) => {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        title,
        content,
        folder_id: folderId ?? null,
        user_id: USER_ID,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("vault_update_document", "Update a document's title or content", {
    id: z.string().describe("Document ID"),
    updates: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      folder_id: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ id, updates }) => {
    const { data, error } = await supabase
      .from("documents")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });
}
