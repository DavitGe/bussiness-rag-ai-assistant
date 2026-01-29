import "server-only";

import { NextResponse } from "next/server";

import { listDocuments } from "@/lib/ragState";
import { seedVectorStoreOnce } from "@/lib/regState";

export const runtime = "nodejs";

export async function GET() {
  // Ensure defaults show up in the preview list on first load.
  await seedVectorStoreOnce();

  const documents = listDocuments().map((d) => ({
    name: d.name,
    text: d.text,
  }));

  return NextResponse.json({ ok: true, documents });
}


