/**
 * Nginx access.log parser.
 * Format default Nginx: $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const NGINX_LOG_PATHS = [
  "/var/log/nginx/access.log",
  "/var/log/nginx/access.log.1",
  "/var/log/nginx/panel-access.log"
];

export interface NginxLogEntry {
  ip: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  bytes: number;
  referer: string;
  userAgent: string;
}

const LOG_REGEX =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]+" (\d+) (\d+) "([^"]*)" "([^"]*)"/;

/**
 * Parse line Nginx access log. Return null kalau tidak match.
 */
export function parseNginxLine(line: string): NginxLogEntry | null {
  const m = line.match(LOG_REGEX);
  if (!m) return null;
  const ts = m[2].replace(":", " ").replace(/\//g, "-");
  const d = new Date(ts + " UTC");
  return {
    ip: m[1],
    timestamp: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
    method: m[3],
    path: m[4],
    status: parseInt(m[5], 10),
    bytes: parseInt(m[6], 10) || 0,
    referer: m[7],
    userAgent: m[8]
  };
}

export interface NginxStats {
  totalRequests: number;
  uniqueIps: number;
  statusBreakdown: Record<string, number>;
  topPaths: Array<{ path: string; count: number }>;
  topIps: Array<{ ip: string; count: number }>;
  topMethods: Array<{ method: string; count: number }>;
  totalBytes: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export async function getNginxStats(maxLines: number = 5000): Promise<NginxStats> {
  let allLines: string[] = [];
  for (const path of NGINX_LOG_PATHS) {
    if (existsSync(path)) {
      try {
        const content = await readFile(path, "utf8");
        const lines = content.split("\n").filter(Boolean);
        allLines = allLines.concat(lines.slice(-maxLines));
      } catch {
        // skip unreadable
      }
    }
  }

  if (allLines.length === 0) {
    return {
      totalRequests: 0,
      uniqueIps: 0,
      statusBreakdown: {},
      topPaths: [],
      topIps: [],
      topMethods: [],
      totalBytes: 0,
      periodStart: null,
      periodEnd: null
    };
  }

  const parsed: NginxLogEntry[] = [];
  for (const line of allLines) {
    const p = parseNginxLine(line);
    if (p) parsed.push(p);
  }

  const ips = new Map<string, number>();
  const paths = new Map<string, number>();
  const methods = new Map<string, number>();
  const status = new Map<string, number>();
  let totalBytes = 0;

  for (const p of parsed) {
    ips.set(p.ip, (ips.get(p.ip) ?? 0) + 1);
    paths.set(p.path, (paths.get(p.path) ?? 0) + 1);
    methods.set(p.method, (methods.get(p.method) ?? 0) + 1);
    const sClass = `${Math.floor(p.status / 100)}xx`;
    status.set(sClass, (status.get(sClass) ?? 0) + 1);
    totalBytes += p.bytes;
  }

  const sortedTop = <T,>(m: Map<T, number>, n = 10) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => ({ [typeof k === "string" ? "key" : "key"]: k, count: v } as never));

  return {
    totalRequests: parsed.length,
    uniqueIps: ips.size,
    statusBreakdown: Object.fromEntries(status),
    topPaths: [...paths.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count })),
    topIps: [...ips.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
    topMethods: [...methods.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => ({ method, count })),
    totalBytes,
    periodStart: parsed[0]?.timestamp ?? null,
    periodEnd: parsed[parsed.length - 1]?.timestamp ?? null
  };
}
