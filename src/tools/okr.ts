import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { USER_ID } from "../types.js";

export function registerOkrTools(server: McpServer) {
  // ── Read Tools ──

  server.tool("okr_get_teams", "List all OKR teams", {}, async () => {
    const { data, error } = await supabase
      .from("okr_teams")
      .select("*, okr_team_members(count)")
      .eq("user_id", USER_ID);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("okr_get_objectives", "List objectives with their key results", {
    teamId: z.string().optional().describe("Filter by team ID"),
  }, async ({ teamId }) => {
    let query = supabase
      .from("objectives")
      .select("*, key_results(*)")
      .eq("user_id", USER_ID);

    if (teamId) query = query.eq("team_id", teamId);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("okr_get_key_result", "Get a key result with its check-in history", {
    id: z.string().describe("Key result ID"),
  }, async ({ id }) => {
    const [krRes, checkinsRes] = await Promise.all([
      supabase
        .from("key_results")
        .select("*, objectives(*)")
        .eq("id", id)
        .eq("user_id", USER_ID)
        .single(),
      supabase
        .from("check_ins")
        .select("*")
        .eq("key_result_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (krRes.error) return { content: [{ type: "text" as const, text: `Error: ${krRes.error.message}` }] };

    const result = {
      ...krRes.data,
      check_ins: checkinsRes.data ?? [],
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("okr_get_progress", "Get overall OKR progress summary across all teams", {}, async () => {
    const { data: objectives, error } = await supabase
      .from("objectives")
      .select("*, key_results(*), okr_teams(name)")
      .eq("user_id", USER_ID);

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

    const summary = (objectives ?? []).map((obj) => {
      const krs = (obj.key_results as Array<{ current_value: number; target_value: number; title: string }>) ?? [];
      const progress = krs.length > 0
        ? krs.reduce((sum, kr) => sum + (kr.target_value > 0 ? (kr.current_value / kr.target_value) * 100 : 0), 0) / krs.length
        : 0;

      return {
        objective: obj.title,
        team: (obj.okr_teams as { name: string } | null)?.name ?? "Unknown",
        quarter: obj.quarter,
        status: obj.status,
        progress: Math.round(progress),
        key_results: krs.map((kr) => ({
          title: kr.title,
          progress: kr.target_value > 0 ? Math.round((kr.current_value / kr.target_value) * 100) : 0,
        })),
      };
    });

    return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
  });

  // ── Write Tools ──

  server.tool("okr_create_objective", "Create a new objective", {
    teamId: z.string().describe("Team ID"),
    title: z.string().describe("Objective title"),
    description: z.string().optional().describe("Objective description"),
    quarter: z.string().optional().describe("Quarter (e.g., Q1 2026)"),
  }, async ({ teamId, title, description, quarter }) => {
    const { data, error } = await supabase
      .from("objectives")
      .insert({
        team_id: teamId,
        title,
        description: description ?? null,
        quarter: quarter ?? null,
        status: "on_track",
        user_id: USER_ID,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("okr_create_key_result", "Create a key result for an objective", {
    objectiveId: z.string().describe("Objective ID"),
    title: z.string().describe("Key result title"),
    targetValue: z.number().describe("Target value"),
    unit: z.string().optional().describe("Unit of measurement (e.g., %, count, $)"),
  }, async ({ objectiveId, title, targetValue, unit }) => {
    const { data, error } = await supabase
      .from("key_results")
      .insert({
        objective_id: objectiveId,
        title,
        target_value: targetValue,
        current_value: 0,
        unit: unit ?? null,
        status: "on_track",
        user_id: USER_ID,
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("okr_add_checkin", "Log a progress check-in for a key result", {
    keyResultId: z.string().describe("Key result ID"),
    value: z.number().describe("Current value"),
    note: z.string().optional().describe("Check-in note"),
  }, async ({ keyResultId, value, note }) => {
    // Insert check-in and update current_value on the key result
    const [checkinRes, updateRes] = await Promise.all([
      supabase
        .from("check_ins")
        .insert({
          key_result_id: keyResultId,
          value,
          note: note ?? null,
          user_id: USER_ID,
        })
        .select()
        .single(),
      supabase
        .from("key_results")
        .update({ current_value: value, updated_at: new Date().toISOString() })
        .eq("id", keyResultId)
        .eq("user_id", USER_ID),
    ]);

    if (checkinRes.error) return { content: [{ type: "text" as const, text: `Error: ${checkinRes.error.message}` }] };
    if (updateRes.error) return { content: [{ type: "text" as const, text: `Check-in saved but failed to update KR: ${updateRes.error.message}` }] };

    return { content: [{ type: "text" as const, text: JSON.stringify(checkinRes.data, null, 2) }] };
  });

  server.tool("okr_update_objective", "Update an objective", {
    id: z.string().describe("Objective ID"),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      quarter: z.string().optional(),
      status: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ id, updates }) => {
    const { data, error } = await supabase
      .from("objectives")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("okr_update_key_result", "Update a key result", {
    id: z.string().describe("Key result ID"),
    updates: z.object({
      title: z.string().optional(),
      target_value: z.number().optional(),
      current_value: z.number().optional(),
      unit: z.string().optional(),
      status: z.string().optional(),
    }).describe("Fields to update"),
  }, async ({ id, updates }) => {
    const { data, error } = await supabase
      .from("key_results")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", USER_ID)
      .select()
      .single();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  });
}
