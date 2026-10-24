import { getVersion } from "@tauri-apps/api/app";
import { CLASSIC_VERSION } from "@/lib/classicVersion";

export type UpdateChannel = "stable" | "beta";

export interface UpdateInfo {
  currentVersion: string;
  availableVersion: string;
  notes?: string;
  pubDate?: string;
}

export interface CheckOptions {
  timeout?: number;
  channel?: UpdateChannel;
}

export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "";
  }
}

export async function checkForUpdate(
  _opts: CheckOptions = {},
): Promise<
  { status: "up-to-date" } | { status: "available"; info: UpdateInfo }
> {
  // CC Switch Classic：更新只看 Classic 主版本（与上游 farion1231 仓库完全无关）。
  // Rust 侧 get_classic_update 读新仓库 latest release 并与 CLASSIC_VERSION 比较，
  // 仓库未建/无 release/限流一律视为无更新。
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{ version: string; release_url: string } | null>(
    "get_classic_update",
  );
  if (!result) {
    return { status: "up-to-date" };
  }
  const info: UpdateInfo = {
    currentVersion: CLASSIC_VERSION,
    availableVersion: result.version,
  };
  return { status: "available", info };
}
