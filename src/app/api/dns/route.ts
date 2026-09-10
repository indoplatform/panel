import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/rbac";
import { isCloudflareConfigured, listDnsRecords, createDnsRecord, type CreateDnsInput } from "@/lib/cloudflare";
import { writeAudit, getClientInfo } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  type: z.string().optional(),
  name: z.string().optional()
});

export async function GET(req: NextRequest) {
  await requireSuperAdmin();
  if (!isCloudflareConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudflare belum dikonfigurasi. Set CLOUDFLARE_API_TOKEN dan CLOUDFLARE_ZONE_ID di .env."
      },
      { status: 503 }
    );
  }
  const { searchParams } = req.nextUrl;
  const filter = querySchema.parse({
    type: searchParams.get("type") ?? undefined,
    name: searchParams.get("name") ?? undefined
  });
  try {
    const records = await listDnsRecords(filter);
    return NextResponse.json({ records });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal load DNS records." },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  type: z.enum(["A", "AAAA", "CNAME", "TXT"]),
  name: z.string().min(1).max(255),
  content: z.string().min(1).max(255),
  ttl: z.number().int().min(1).max(86400).optional(),
  proxied: z.boolean().optional(),
  comment: z.string().max(500).optional()
});

export async function POST(req: NextRequest) {
  const user = await requireSuperAdmin();
  const { ip, userAgent } = await getClientInfo(req.headers);
  let body: CreateDnsInput;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }
  try {
    const record = await createDnsRecord(body);
    await writeAudit({
      user,
      action: "DNS_CREATE",
      entity: "dns",
      entityId: record.id,
      details: { type: body.type, name: body.name, content: body.content, proxied: body.proxied },
      ipAddress: ip,
      userAgent
    });
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal create DNS." },
      { status: 500 }
    );
  }
}
