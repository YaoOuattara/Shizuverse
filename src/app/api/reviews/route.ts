import { NextRequest, NextResponse } from "next/server";

const FLASK_API = process.env.FLASK_API_URL || "https://shizu-verse.onrender.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(`${FLASK_API}/api/reviews/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: response.status });
    } catch {
      return NextResponse.json(
        { error: `Flask error ${response.status}: ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
