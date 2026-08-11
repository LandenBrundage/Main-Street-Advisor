import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  new URL(
    "../supabase/migrations/202607110001_goals_and_repair_functions.sql",
    import.meta.url,
  ),
  "utf8",
);
const memorySql = readFileSync(
  new URL(
    "../supabase/migrations/202607130001_memory_profile_settings.sql",
    import.meta.url,
  ),
  "utf8",
);
const completionSql = readFileSync(
  new URL(
    "../supabase/migrations/202607140001_completion_workflows.sql",
    import.meta.url,
  ),
  "utf8",
);
describe("goal migration safety", () => {
  it("preserves tasks while removing folder assignments", () => {
    expect(sql).toContain("update public.tasks set folder_id = null");
    expect(sql).not.toMatch(/drop table\s+public\.task_folders/i);
    expect(sql).not.toMatch(/delete from public\.tasks/i);
  });
  it("moves tasks to no goal before deleting a goal", () => {
    expect(sql).toMatch(
      /update public\.tasks set goal_id = null[\s\S]*delete from public\.goals/i,
    );
  });
  it("locks proposals and marks approved only after task inserts", () => {
    expect(sql).toMatch(/for update/i);
    expect(sql.indexOf("insert into public.tasks")).toBeLessThan(
      sql.indexOf("set status = 'approved'"),
    );
  });
  it("returns existing tasks for duplicate approvals", () => {
    expect(sql).toContain("already_approved");
    expect(sql).toContain("ai_action_request_id = proposal.id");
  });
  it("enforces membership in privileged functions", () => {
    expect(sql).toContain("public.is_business_member(p_business_id)");
  });
});

describe("memory and profile migration safety", () => {
  it("is additive and preserves legacy profile and task data", () => {
    expect(memorySql).toContain("add column if not exists profile_details");
    expect(memorySql).not.toMatch(/drop\s+(column|table)/i);
    expect(memorySql).not.toMatch(/delete\s+from\s+public\.tasks/i);
    const approvalStart = memorySql.indexOf(
      "create or replace function public.approve_task_completion",
    );
    const taskStatusUpdate = memorySql.indexOf(
      "update public.tasks\n  set status = 'completed'",
    );
    expect(taskStatusUpdate).toBeGreaterThan(approvalStart);
  });

  it("records summary boundaries so the same messages are not summarized twice", () => {
    expect(memorySql).toContain("p_expected_message_count");
    expect(memorySql).toContain("if current_count <> p_expected_message_count");
    expect(memorySql).toContain(
      "unique (conversation_id, through_message_count)",
    );
  });

  it("requires membership and explicit approval before task completion", () => {
    expect(memorySql).toMatch(
      /approve_task_completion[\s\S]*public\.is_business_member\(p_business_id\)/,
    );
    expect(memorySql).toMatch(
      /for update;[\s\S]*status <> 'proposed'[\s\S]*update public\.tasks/,
    );
    expect(memorySql.indexOf("update public.tasks")).toBeLessThan(
      memorySql.lastIndexOf("set status = 'approved'"),
    );
  });
});

describe("completion workflow migration", () => {
  it("adds completion history without deleting goals, tasks, or legacy profile data", () => {
    expect(completionSql).toContain("add column if not exists completed_at");
    expect(completionSql).toContain("previous_incomplete_status");
    expect(completionSql).not.toMatch(/delete\s+from\s+public\.(tasks|goals)/i);
    expect(completionSql).not.toMatch(/drop\s+(table|column)/i);
  });

  it("records task timestamps and the previous incomplete status in a trigger", () => {
    expect(completionSql).toMatch(
      /sync_task_completion_fields[\s\S]*new\.previous_incomplete_status = old\.status/,
    );
    expect(completionSql).toMatch(
      /new\.status = 'completed'[\s\S]*new\.completed_at = coalesce\(new\.completed_at, old\.completed_at, now\(\)\)/,
    );
    expect(completionSql).toMatch(/else[\s\S]*new\.completed_at = null/);
  });

  it("locks the goal and atomically supports goal-only or goal-and-task completion", () => {
    expect(completionSql).toContain(
      "create or replace function public.set_goal_completion",
    );
    expect(completionSql).toMatch(
      /public\.is_business_member\(p_business_id\)[\s\S]*for update/,
    );
    expect(completionSql).toMatch(
      /if p_complete_remaining_tasks then[\s\S]*update public\.tasks[\s\S]*set status = 'completed'/,
    );
    expect(completionSql).toMatch(
      /if p_completed then[\s\S]*update public\.goals[\s\S]*set status = 'completed'[\s\S]*else[\s\S]*set status = 'incomplete'/,
    );
  });

  it("backfills an old profile name only when the account name is empty", () => {
    expect(completionSql).toContain("business.profile_details->>'name'");
    expect(completionSql).toContain(
      "and trim(coalesce(profile.full_name, '')) = ''",
    );
    expect(completionSql).not.toMatch(/profile_details\s+-\s+'name'/);
  });

  it("restricts the atomic completion function to authenticated callers", () => {
    expect(completionSql).toContain(
      "revoke all on function public.set_goal_completion(uuid, uuid, boolean, boolean) from public",
    );
    expect(completionSql).toContain(
      "grant execute on function public.set_goal_completion(uuid, uuid, boolean, boolean) to authenticated",
    );
  });
});
