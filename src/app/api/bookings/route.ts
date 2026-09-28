import { NextRequest, NextResponse } from "next/server";

const FLASK_API =
  process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json();
    // The body is never logged: it carries the client's name and phone.
    // Status, reference and duration are enough to diagnose a failed booking.
    const response = await fetch(`${FLASK_API}/api/bookings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const ref = typeof data?.id === "number" ? `#${data.id}` : "-";
      console.log(`[bookings] POST ${response.status} ref=${ref} ${Date.now() - started}ms`);
      return NextResponse.json(data, { status: response.status });
    } catch {
      console.error(`[bookings] POST ${response.status} non-JSON response ${Date.now() - started}ms`);
      return NextResponse.json(
        { error: `Flask error ${response.status}: ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[bookings] POST proxy error after ${Date.now() - started}ms: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = searchParams.toString();
    const response = await fetch(
      `${FLASK_API}/api/bookings/${params ? "?" + params : ""}`
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to reach booking service" },
      { status: 502 }
    );
  }
}
