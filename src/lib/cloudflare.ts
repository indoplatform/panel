/**
 * Cloudflare API v4 client.
 * Scope minimum: Zone:DNS:Edit + Zone:Zone:Read.
 */
import axios, { AxiosInstance } from "axios";

const API_BASE = "https://api.cloudflare.com/client/v4";

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  comment?: string | null;
  created_on: string;
  modified_on: string;
}

interface CfListResponse {
  result: DnsRecord[];
  result_info: { total_pages: number; page: number; per_page: number; count: number; total_count: number };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

interface CfSingleResponse<T> {
  result: T;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

function getClient(): AxiosInstance | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return null;
  return axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    timeout: 15000
  });
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

export async function listDnsRecords(filter?: {
  type?: string;
  name?: string;
}): Promise<DnsRecord[]> {
  const client = getClient();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!client || !zoneId) {
    throw new Error("Cloudflare belum dikonfigurasi (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID).");
  }
  const params: Record<string, string | number> = { per_page: 100 };
  if (filter?.type) params.type = filter.type;
  if (filter?.name) params.name = filter.name;

  const records: DnsRecord[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    params.page = page;
    const { data } = await client.get<CfListResponse>(`/zones/${zoneId}/dns_records`, { params });
    if (!data.success) {
      throw new Error(`Cloudflare error: ${data.errors.map((e) => e.message).join(", ")}`);
    }
    records.push(...data.result);
    if (page >= data.result_info.total_pages) break;
    page++;
  }
  return records;
}

export interface CreateDnsInput {
  type: "A" | "AAAA" | "CNAME" | "TXT";
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  comment?: string;
}

export async function createDnsRecord(input: CreateDnsInput): Promise<DnsRecord> {
  const client = getClient();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!client || !zoneId) {
    throw new Error("Cloudflare belum dikonfigurasi.");
  }
  const { data } = await client.post<CfSingleResponse<DnsRecord>>(
    `/zones/${zoneId}/dns_records`,
    {
      type: input.type,
      name: input.name,
      content: input.content,
      ttl: input.ttl ?? 1,
      proxied: input.proxied ?? true,
      comment: input.comment
    }
  );
  if (!data.success) {
    throw new Error(`Cloudflare error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}

export async function deleteDnsRecord(id: string): Promise<void> {
  const client = getClient();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!client || !zoneId) {
    throw new Error("Cloudflare belum dikonfigurasi.");
  }
  const { data } = await client.delete<CfSingleResponse<{ id: string }>>(
    `/zones/${zoneId}/dns_records/${id}`
  );
  if (!data.success) {
    throw new Error(`Cloudflare error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}

export async function updateDnsRecord(
  id: string,
  patch: Partial<CreateDnsInput>
): Promise<DnsRecord> {
  const client = getClient();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!client || !zoneId) {
    throw new Error("Cloudflare belum dikonfigurasi.");
  }
  const { data } = await client.patch<CfSingleResponse<DnsRecord>>(
    `/zones/${zoneId}/dns_records/${id}`,
    patch
  );
  if (!data.success) {
    throw new Error(`Cloudflare error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}
