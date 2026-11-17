import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { USER_ID } from "../types.js";

export function registerChangeTools(server: McpServer) {
  // ── Read Tools ──

  server.tool("change_get_projects", "List all change management projects with status and risk level", {}, async () => {
    const { data, error } = await supabase
      .from("change_projects")
      .select("*")
      .eq("user_id", USER_ID)
      .order("updated_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_get_project", "Get full project details with stakeholders, milestones, and groups", {
    id: z.string().describe("Project ID"),
  }, async ({ id }) => {
    const [projectRes, stakeholdersRes, milestonesRes, groupsRes] = await Promise.all([
      supabase.from("change_projects").select("*").eq("id", id).eq("user_id", USER_ID).single(),
      supabase
        .from("project_stakeholders")
        .select("*, global_stakeholders(*)")
        .eq("project_id", id),
      supabase.from("milestones").select("*").eq("project_id", id).order("date"),
      supabase
        .from("project_groups")
        .select("*, stakeholder_groups(*)")
        .eq("project_id", id),
    ]);

    if (projectRes.error) return { content: [{ type: "text" as const, text: `Error: ${projectRes.error.message}` }] };

    // Surface sub-query errors so they aren't silently swallowed
    const errors: string[] = [];
    if (stakeholdersRes.error) errors.push(`Stakeholders: ${stakeholdersRes.error.message}`);
    if (milestonesRes.error) errors.push(`Milestones: ${milestonesRes.error.message}`);
    if (groupsRes.error) errors.push(`Groups: ${groupsRes.error.message}`);

    const result = {
      ...projectRes.data,
      stakeholders: stakeholdersRes.data ?? [],
      milestones: milestonesRes.data ?? [],
      groups: groupsRes.data ?? [],
      ...(errors.length > 0 ? { _errors: errors } : {}),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("change_get_stakeholder", "Get stakeholder with ADKAR scores, engagement, notes, and score history", {
    id: z.string().describe("Project stakeholder ID"),
  }, async ({ id }) => {
    const [stakeholderRes, historyRes] = await Promise.all([
      supabase
        .from("project_stakeholders")
        .select("*, global_stakeholders(*)")
        .eq("id", id)
        .single(),
      supabase
        .from("score_history")
        .select("*")
        .eq("stakeholder_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (stakeholderRes.error) return { content: [{ type: "text" as const, text: `Error: ${stakeholderRes.error.message}` }] };

    const result = {
      ...stakeholderRes.data,
      score_history: historyRes.data ?? [],
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("change_get_groups", "List all stakeholder groups", {}, async () => {
    const { data, error } = await supabase
      .from("stakeholder_groups")
      .select("*")
      .eq("user_id", USER_ID);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_search_stakeholders", "Search stakeholders by name or role", {
    query: z.string().describe("Search query (name or role)"),
  }, async ({ query }) => {
    const { data, error } = await supabase
      .from("global_stakeholders")
      .select("*")
      .eq("user_id", USER_ID)
      .or(`name.ilike.%${query}%,role.ilike.%${query}%`);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  // ── Write Tools ──

  server.tool("change_create_project", "Create a new change management project", {
    name: z.string().describe("Project name"),
    description: z.string().optional().describe("Project description"),
    status: z.string().optional().describe("Project status (e.g., planning, active, completed)"),
  }, async ({ name, description, status }) => {
    const { data, error } = await supabase
      .from("change_projects")
      .insert({
        name,
        description: description ?? null,
        status: status ?? "planning",
        user_id: USER_ID,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_update_project", "Update project details", {
    id: z.string().describe("Project ID"),
    updates: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      risk_level: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ id, updates }) => {
    const { data, error } = await supabase
      .from("change_projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_add_stakeholder", "Add a stakeholder to a project", {
    projectId: z.string().describe("Project ID"),
    stakeholderId: z.string().describe("Global stakeholder ID"),
    type: z.string().optional().describe("Stakeholder type (e.g., sponsor, champion, impacted)"),
    influenceLevel: z.string().optional().describe("Influence level (e.g., high, medium, low)"),
  }, async ({ projectId, stakeholderId, type, influenceLevel }) => {
    const { data, error } = await supabase
      .from("project_stakeholders")
      .insert({
        project_id: projectId,
        stakeholder_id: stakeholderId,
        stakeholder_type: type ?? null,
        influence_level: influenceLevel ? parseInt(influenceLevel) || 5 : 5,
      })
      .select("*, global_stakeholders(*)")
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_update_stakeholder", "Update stakeholder ADKAR scores, engagement, or notes", {
    id: z.string().describe("Project stakeholder ID"),
    updates: z.object({
      awareness: z.number().optional(),
      desire: z.number().optional(),
      knowledge: z.number().optional(),
      ability: z.number().optional(),
      reinforcement: z.number().optional(),
      engagement: z.string().optional(),
      notes: z.string().optional(),
      type: z.string().optional(),
      influence_level: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ id, updates }) => {
    const { data, error } = await supabase
      .from("project_stakeholders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, global_stakeholders(*)")
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_add_milestone", "Add a milestone to a project", {
    projectId: z.string().describe("Project ID"),
    name: z.string().describe("Milestone name"),
    date: z.string().describe("Target date (YYYY-MM-DD)"),
    type: z.string().describe("Milestone type (e.g., go-live, training, communication)"),
    description: z.string().optional().describe("Milestone description"),
  }, async ({ projectId, name, date, type, description }) => {
    const { data, error } = await supabase
      .from("milestones")
      .insert({
        project_id: projectId,
        name,
        date,
        type,
        description: description ?? null,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("change_add_note", "Add a note to a stakeholder's score history", {
    stakeholderId: z.string().describe("Project stakeholder ID"),
    note: z.string().describe("Note content"),
  }, async ({ stakeholderId, note }) => {
    const { data, error } = await supabase
      .from("score_history")
      .insert({
        stakeholder_id: stakeholderId,
        dimension: "note",
        score: 0,
        note,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });
}
