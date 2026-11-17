import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { USER_ID } from "../types.js";

export function registerCrossAppTools(server: McpServer) {
  server.tool(
    "create_tasks_from_stakeholders",
    "Bulk create Tick tasks from Change stakeholders matching a filter (e.g., all with Desire < 50)",
    {
      projectId: z.string().describe("Change project ID to pull stakeholders from"),
      filter: z.object({
        dimension: z
          .enum(["awareness", "desire", "knowledge", "ability", "reinforcement"])
          .describe("ADKAR dimension to filter on"),
        operator: z.enum(["lt", "lte", "gt", "gte", "eq"]).describe("Comparison operator"),
        value: z.number().describe("Threshold value"),
      }).describe("Filter criteria for stakeholders"),
      taskTemplate: z.object({
        boardId: z.string().describe("Tick board ID to create tasks on"),
        titlePrefix: z.string().optional().describe("Prefix for task titles (default: 'Follow up with')"),
        description: z.string().optional().describe("Task description template"),
        dueDate: z.string().optional().describe("Due date for created tasks (YYYY-MM-DD)"),
      }).describe("Template for the tasks to create"),
    },
    async ({ projectId, filter, taskTemplate }) => {
      // Fetch stakeholders for the project
      const { data: stakeholders, error: fetchError } = await supabase
        .from("project_stakeholders")
        .select("*, global_stakeholders(name, role)")
        .eq("project_id", projectId);

      if (fetchError) return { content: [{ type: "text" as const, text: `Error fetching stakeholders: ${fetchError.message}` }] };

      // Apply filter
      const opFn: Record<string, (a: number, b: number) => boolean> = {
        lt: (a, b) => a < b,
        lte: (a, b) => a <= b,
        gt: (a, b) => a > b,
        gte: (a, b) => a >= b,
        eq: (a, b) => a === b,
      };

      const matches = (stakeholders ?? []).filter((s) => {
        const score = s[filter.dimension] as number | null;
        if (score === null || score === undefined) return false;
        return opFn[filter.operator](score, filter.value);
      });

      if (matches.length === 0) {
        return { content: [{ type: "text" as const, text: "No stakeholders matched the filter. No tasks created." }] };
      }

      // Create tasks
      const prefix = taskTemplate.titlePrefix ?? "Follow up with";
      const tasks = matches.map((s) => ({
        board_id: taskTemplate.boardId,
        title: `${prefix} ${(s.global_stakeholders as { name: string } | null)?.name ?? "Unknown"} (${filter.dimension}: ${s[filter.dimension]})`,
        description: taskTemplate.description ?? `Auto-generated from Change project. ${filter.dimension} score is ${s[filter.dimension]}, below threshold of ${filter.value}.`,
        status: "todo",
        due_date: taskTemplate.dueDate ?? null,
        user_id: USER_ID,
      }));

      const { data: created, error: insertError } = await supabase
        .from("tasks")
        .insert(tasks)
        .select();

      if (insertError) return { content: [{ type: "text" as const, text: `Error creating tasks: ${insertError.message}` }] };

      return {
        content: [{
          type: "text" as const,
          text: `Created ${created?.length ?? 0} tasks from ${matches.length} matching stakeholders.\n\n${JSON.stringify(created, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "link_task_to_kr",
    "Connect a Tick task to an OKR key result by adding a reference in the task description",
    {
      taskId: z.string().describe("Tick task ID"),
      keyResultId: z.string().describe("OKR key result ID"),
    },
    async ({ taskId, keyResultId }) => {
      // Fetch both the task and key result
      const [taskRes, krRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", taskId).eq("user_id", USER_ID).single(),
        supabase.from("key_results").select("*, objectives(title)").eq("id", keyResultId).eq("user_id", USER_ID).single(),
      ]);

      if (taskRes.error) return { content: [{ type: "text" as const, text: `Error fetching task: ${taskRes.error.message}` }] };
      if (krRes.error) return { content: [{ type: "text" as const, text: `Error fetching key result: ${krRes.error.message}` }] };

      const kr = krRes.data;
      const objectiveTitle = (kr.objectives as { title: string } | null)?.title ?? "Unknown";
      const linkText = `\n\n---\nLinked OKR: ${objectiveTitle} → ${kr.title} (${kr.current_value}/${kr.target_value} ${kr.unit ?? ""})`;

      const existingDesc = taskRes.data.description ?? "";
      const newDesc = existingDesc.includes("Linked OKR:")
        ? existingDesc.replace(/\n\n---\nLinked OKR:.*$/s, linkText)
        : existingDesc + linkText;

      const { data, error } = await supabase
        .from("tasks")
        .update({ description: newDesc, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("user_id", USER_ID)
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error updating task: ${error.message}` }] };

      return {
        content: [{
          type: "text" as const,
          text: `Linked task "${data.title}" to KR "${kr.title}" under objective "${objectiveTitle}".\n\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }
  );
}
