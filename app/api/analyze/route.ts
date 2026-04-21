import { NextResponse } from "next/server";
import { analyzeListing } from "@/lib/analyze";

export async function POST(req: Request) {
  const body = await req.json();

  const result = await analyzeListing(body);

  return NextResponse.json(result);
}