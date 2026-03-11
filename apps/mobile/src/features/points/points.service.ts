import type { Database, PointLedgerRow } from "@foryou/types";
import { supabase } from "../../lib/supabase/client";

type ProcessPendingPointsRpcReturn =
  Database["public"]["Functions"]["process_pending_points"]["Returns"];
type ReversePostRewardRpcReturn =
  Database["public"]["Functions"]["reverse_post_reward"]["Returns"];

export type ProcessPendingPointsResult = {
  processedRows: number;
  affectedUsers: number;
};

export type ReversePostRewardResult = {
  cancelledPendingRows: number;
  reversedConfirmedRows: number;
  deductedPoints: number;
};

export type PointStatusSummary = {
  availablePoints: number;
  pendingPoints: number;
  pendingEntries: number;
};

function getFirstRow<T>(data: T[] | null, rpcName: string): T {
  if (!data || data.length === 0) {
    throw new Error(`${rpcName} returned no rows.`);
  }

  return data[0];
}

export async function processPendingPoints(): Promise<ProcessPendingPointsResult> {
  const { data, error } = await supabase.rpc("process_pending_points");

  if (error) {
    throw error;
  }

  const row = getFirstRow<ProcessPendingPointsRpcReturn[number]>(
    data,
    "process_pending_points"
  );

  return {
    processedRows: row.processed_rows,
    affectedUsers: row.affected_users
  };
}

export async function reversePostReward(postId: number): Promise<ReversePostRewardResult> {
  const { data, error } = await supabase.rpc("reverse_post_reward", {
    p_post_id: postId
  });

  if (error) {
    throw error;
  }

  const row = getFirstRow<ReversePostRewardRpcReturn[number]>(
    data,
    "reverse_post_reward"
  );

  return {
    cancelledPendingRows: row.cancelled_pending_rows,
    reversedConfirmedRows: row.reversed_confirmed_rows,
    deductedPoints: row.deducted_points
  };
}

export async function fetchMyPointStatusSummary(): Promise<PointStatusSummary> {
  const { data, error } = await supabase
    .from("point_ledger")
    .select("amount, available_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const now = Date.now();

  const rows = (data ?? []) as Pick<PointLedgerRow, "amount" | "available_at">[];

  return rows.reduce(
    (summary, row) => {
      const availableAt = new Date(row.available_at).getTime();
      const isPending = Number.isFinite(availableAt) && availableAt > now;

      if (isPending) {
        return {
          ...summary,
          pendingPoints: summary.pendingPoints + row.amount,
          pendingEntries: summary.pendingEntries + 1
        };
      }

      return {
        ...summary,
        availablePoints: summary.availablePoints + row.amount
      };
    },
    {
      availablePoints: 0,
      pendingPoints: 0,
      pendingEntries: 0
    }
  );
}
