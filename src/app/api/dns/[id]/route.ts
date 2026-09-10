import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/rbac";
import { deleteDnsRecord, updateDnsRecord, type CreateDnsInput } from "@/lib/cloudflare";
import { writeAudit, getClientInfo } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireSuperAdmin();
  const { ip, userAgent } = await getClientInfo(req.headers);
  try {
    await deleteDnsRecord(params.id);
    await writeAudit({
      user,
      action: "DNS_DELETE",
      entity: "dns",
      entityId: params.id,
      ipAddress: ip,
      userAgent
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal hapus DNS." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireSuperAdmin();
  const { ip, userAgent } = await getClientInfo(req.headers);
  const body = (await req.json()) as Partial<CreateDnsInput>;
  try {
    const record = await updateDnsRecord(params.id, body);
    await writeAudit({
      user,
      action: "DNS_UPDATE",
      entity: "dns",
      entityId: params.id,
      details: body,
      ipAddress: ip,
      userAgent
    });
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal update DNS." },
      { status: 500 }
    );
  }
}
