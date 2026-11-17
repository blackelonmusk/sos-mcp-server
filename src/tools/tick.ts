import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { USER_ID } from "../types.js";

export function registerTickTools(server: McpServer) {
  // ── Read Tools ──

  server.tool("tick_get_workspaces", "List all Tick PM workspaces", {}, async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", USER_ID);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_get_boards", "List boards with task counts", {
    workspaceId: z.string().optional().describe("Filter by workspace ID"),
  }, async ({ workspaceId }) => {
    let query = supabase
      .from("boards")
      .select("*, tasks(count)")
      .eq("user_id", USER_ID);

    if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_get_tasks", "List tasks from a board, optionally filtered by status", {
    boardId: z.string().describe("Board ID"),
    status: z.string().optional().describe("Filter by status (todo, in_progress, done)"),
  }, async ({ boardId, status }) => {
    let query = supabase
      .from("tasks")
      .select("*, task_labels(*, labels(*))")
      .eq("board_id", boardId)
      .eq("user_id", USER_ID);

    if (status) query = query.eq("status", status);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_get_task", "Get a single task with full details", {
    taskId: z.string().describe("Task ID"),
  }, async ({ taskId }) => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*, task_labels(*, labels(*))")
      .eq("id", taskId)
      .eq("user_id", USER_ID)
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  // ── Write Tools ──

  server.tool("tick_create_task", "Create a new task on a board", {
    boardId: z.string().describe("Board ID"),
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    status: z.string().optional().describe("Status (todo, in_progress, done)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    assigneeId: z.string().optional().describe("Assignee user ID"),
  }, async ({ boardId, title, description, status, dueDate, assigneeId }) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        board_id: boardId,
        title,
        description: description ?? null,
        status: status ?? "todo",
        due_date: dueDate ?? null,
        assignee_id: assigneeId ?? null,
        user_id: USER_ID,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_update_task", "Update any task field", {
    taskId: z.string().describe("Task ID"),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      due_date: z.string().optional(),
      assignee_id: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ taskId, updates }) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_move_task", "Move a task to a new status", {
    taskId: z.string().describe("Task ID"),
    status: z.string().describe("New status (todo, in_progress, done)"),
  }, async ({ taskId, status }) => {
    const { data, error } = await supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("tick_delete_task", "Delete a task", {
    taskId: z.string().describe("Task ID"),
  }, async ({ taskId }) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", USER_ID);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: "Task deleted successfully." }] };
  });
}
