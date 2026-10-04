/**
 * System / VPS monitoring helpers.
 * Pakai library `systeminformation` — pure Node.js, no native deps.
 */
import si from "systeminformation";
import { exec } from "child_process";
import { promisify } from "util";
import type { MonitoredService } from "@prisma/client";

type ServiceStatusType = "ACTIVE" | "INACTIVE" | "FAILED" | "DEGRADED" | "UNKNOWN";

const execp = promisify(exec);

export interface VpsMetrics {
  timestamp: string;
  hostname: string;
  uptime: number;
  // CPU
  cpuPercent: number;
  cpuCores: number;
  loadAvg: { one: number; five: number; fifteen: number };
  // Memory
  memory: { total: number; used: number; percent: number };
  swap: { total: number; used: number };
  // Disk
  disk: { total: number; used: number; percent: number };
  // Disk IO throughput
  diskIo: { readBytesPerSec: number; writeBytesPerSec: number };
  // Network
  network: { rxBytes: number; txBytes: number; rxBytesPerSec: number; txBytesPerSec: number };
  // GPU
  gpu: { utilizationPercent: number; memUsedMB: number; memTotalMB: number; vendor: string; model: string } | null;
  // Processes
  processCount: number;
  // Top processes (by CPU)
  topProcesses: Array<{ pid: number; name: string; cpu: number; mem: number }>;
}

export async function collectVpsMetrics(): Promise<VpsMetrics> {
  const [
    cpu,
    cpuLoad,
    mem,
    fs,
    netStats,
    os,
    processes,
    time,
    graphics,
    disksIO
  ] = await Promise.all([
    si.currentLoad(),
    si.currentLoad(), // si.load() removed in v5.x; use currentLoad avg instead
    si.mem(),
    si.fsSize(),
    si.networkStats(),
    si.osInfo(),
    si.processes(),
    si.time(),
    si.graphics().catch(() => ({ controllers: [] })),
    si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0, tIO_sec: 0 }))
  ]);

  // Primary disk (root)
  const root = fs.find((d: si.Systeminformation.FsSizeData) => d.mount === "/") ?? fs[0];

  // Primary network (first non-loopback)
  const net = netStats.find(
    (n: si.Systeminformation.NetworkStatsData) =>
      !(n as { internal?: boolean }).internal && n.operstate !== "down"
  ) ?? netStats[0];

  // GPU (first controller, jika ada)
  const gpuController = (graphics as { controllers?: Array<{ utilizationGpu?: number; memoryUsed?: number; memoryTotal?: number; vendor?: string; model?: string; name?: string }> })
    .controllers?.[0] ?? null;
  const gpu = gpuController
    ? {
        utilizationPercent: gpuController.utilizationGpu ?? 0,
        memUsedMB: (gpuController.memoryUsed ?? 0) / 1024 / 1024,
        memTotalMB: (gpuController.memoryTotal ?? 0) / 1024 / 1024,
        vendor: gpuController.vendor ?? "",
        model: gpuController.model ?? gpuController.name ?? "GPU"
      }
    : null;

  // Disk IO throughput (bytes/sec dari systeminformation, langsung rate)
  const diskIo = disksIO ?? { rIO_sec: 0, wIO_sec: 0 };

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname,
    uptime: time.uptime ?? 0,
    cpuPercent: Math.round((cpu.currentLoad ?? 0) * 100) / 100,
    cpuCores: cpu.cpus?.length ?? 1,
    loadAvg: {
      one: cpuLoad.avgLoad ?? 0,
      five: cpuLoad.avgLoad ?? 0,
      fifteen: cpuLoad.avgLoad ?? 0
    },
    memory: {
      total: mem.total,
      used: mem.active ?? mem.used,
      percent: ((mem.active ?? mem.used) / mem.total) * 100
    },
    swap: {
      total: mem.swaptotal,
      used: mem.swapused
    },
    disk: root
      ? {
          total: root.size,
          used: root.used,
          percent: root.use
        }
      : { total: 0, used: 0, percent: 0 },
    diskIo: {
      readBytesPerSec: (diskIo as { rIO_sec?: number; rIO?: number }).rIO_sec ?? (diskIo as { rIO?: number }).rIO ?? 0,
      writeBytesPerSec: (diskIo as { wIO_sec?: number; wIO?: number }).wIO_sec ?? (diskIo as { wIO?: number }).wIO ?? 0
    },
    network: {
      rxBytes: net?.rx_bytes ?? 0,
      txBytes: net?.tx_bytes ?? 0,
      rxBytesPerSec: net?.rx_sec ?? 0,
      txBytesPerSec: net?.tx_sec ?? 0
    },
    gpu,
    processCount: processes.all ?? 0,
    topProcesses: (processes.list ?? [])
      .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0))
      .slice(0, 10)
      .map((p) => ({
        pid: p.pid,
        name: p.name ?? "?",
        cpu: Math.round((p.cpu ?? 0) * 100) / 100,
        mem: Math.round((p.mem ?? 0) * 100) / 100
      }))
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

// ============================================================
// SERVICE MANAGEMENT
// ============================================================

export type ServiceAction = "start" | "stop" | "restart" | "status";

export interface ServiceExecOptions {
  /** SSH connection (kosong = local exec). */
  ssh?: {
    host: string;
    user: string;
    keyPath?: string;
  };
  /** Timeout ms. Default 15000. */
  timeoutMs?: number;
}

export interface ServiceExecResult {
  action: ServiceAction;
  service: string;
  success: boolean;
  status?: ServiceStatusType;
  output: string;
  timestamp: string;
}

/**
 * Execute systemctl command. Default LOCAL exec (asumsi panel di VPS yang sama).
 * Untuk remote, set ssh opts — function ini akan return error bahwa SSH
 * belum diimplementasi (caller harus pakai SSH lib seperti `ssh2`).
 */
export async function execSystemctl(
  service: string,
  action: ServiceAction,
  opts: ServiceExecOptions = {}
): Promise<ServiceExecResult> {
  const timestamp = new Date().toISOString();

  if (opts.ssh) {
    return {
      action,
      service,
      success: false,
      output:
        "Remote SSH service management belum diimplementasi di V1.0. Untuk remote, integrasikan dengan library ssh2 atau node-ssh.",
      timestamp
    };
  }

  const allowed: ServiceAction[] = ["start", "stop", "restart", "status"];
  if (!allowed.includes(action)) {
    return {
      action,
      service,
      success: false,
      output: `Action tidak dikenal: ${action}`,
      timestamp
    };
  }

  // Validate service name (alphanumeric + dash + dot + @)
  if (!/^[a-zA-Z0-9._@-]+$/.test(service)) {
    return {
      action,
      service,
      success: false,
      output: `Nama service tidak valid: ${service}`,
      timestamp
    };
  }

  const cmd = `systemctl ${action} ${service}`;
  const timeoutMs = opts.timeoutMs ?? 15000;

  try {
    const { stdout, stderr } = await execp(cmd, { timeout: timeoutMs });
    const status = await readServiceStatus(service);
    return {
      action,
      service,
      success: true,
      status,
      output: [stdout, stderr].filter(Boolean).join("\n").trim(),
      timestamp
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    return {
      action,
      service,
      success: false,
      output: [
        e.stdout ?? "",
        e.stderr ?? "",
        e.killed ? "(timeout)" : "",
        e.message ?? ""
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
      timestamp
    };
  }
}

export async function readServiceStatus(service: string): Promise<ServiceStatusType> {
  try {
    const { stdout } = await execp(
      `systemctl is-active ${service}`,
      { timeout: 5000 }
    );
    const s = stdout.trim();
    if (s === "active") return "ACTIVE";
    if (s === "inactive") return "INACTIVE";
    if (s === "failed") return "FAILED";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export async function listAllServices(): Promise<MonitoredService[]> {
  // Caller prisma direct di service layer
  return [];
}

// ============================================================
// LOG VIEWER (journalctl)
// ============================================================

export interface LogLine {
  timestamp: string;
  unit: string;
  priority: string;
  message: string;
}

export async function getServiceLogs(
  service: string,
  options: { lines?: number; since?: string } = {}
): Promise<LogLine[]> {
  const lines = Math.min(options.lines ?? 100, 1000);
  const since = options.since ?? "yesterday";

  // Validate service name
  if (!/^[a-zA-Z0-9._@-]+$/.test(service)) {
    return [];
  }

  // Use date-only format YYYY-MM-DD — full ISO timestamps with T separator
  // confuse some systemd journalctl versions (returns kernel boot msgs).
  // Default to 7 days back to capture freshly-deployed services.
  const sinceDate = options.since
    ? new Date(Date.now() - parseSinceToMs(options.since))
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceDateOnly = sinceDate.toISOString().slice(0, 10);

  try {
    const { stdout } = await execp(
      `/usr/bin/journalctl -u ${service} --since=${JSON.stringify(sinceDateOnly)} --no-pager -n ${lines} -o json`,
      { timeout: 10000, maxBuffer: 4 * 1024 * 1024 }
    );
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const j = JSON.parse(line) as Record<string, unknown>;
          return {
            timestamp: new Date((j.__REALTIME_TIMESTAMP as number) / 1000).toISOString(),
            unit: (j._SYSTEMD_UNIT as string) ?? service,
            priority: PRIORITY_NAMES[j.PRIORITY as number] ?? "INFO",
            message: ((j.MESSAGE as string) ?? "").trim()
          };
        } catch {
          return {
            timestamp: new Date().toISOString(),
            unit: service,
            priority: "INFO",
            message: line
          };
        }
      })
      .reverse(); // newest first
  } catch {
    return [];
  }
}

const PRIORITY_NAMES: Record<number, string> = {
  0: "EMERG",
  1: "ALERT",
  2: "CRIT",
  3: "ERR",
  4: "WARN",
  5: "NOTICE",
  6: "INFO",
  7: "DEBUG"
};

// Parse "1 hour ago", "30 minutes ago", "2 days ago" → milliseconds
function parseSinceToMs(s: string): number {
  const m = s.trim().match(/^(\d+)\s*(minute|minutes|min|hour|hours|day|days|week|weeks|month|months)s?(?:\s+ago)?$/i);
  if (!m) return 60 * 60 * 1000; // default 1h
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("min")) return n * 60 * 1000;
  if (unit.startsWith("hour")) return n * 60 * 60 * 1000;
  if (unit.startsWith("day")) return n * 24 * 60 * 60 * 1000;
  if (unit.startsWith("week")) return n * 7 * 24 * 60 * 60 * 1000;
  if (unit.startsWith("month")) return n * 30 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}
