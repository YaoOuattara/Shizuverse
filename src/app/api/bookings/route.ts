import { NextRequest, NextResponse } from "next/server";

const FLASK_API =
  process.env.FLASK_API_URL || "https://shizu-verse.onrender.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Proxying to:", `${FLASK_API}/api/bookings/`);
    const response = await fetch(`${FLASK_API}/api/bookings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Proxy error:", msg);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return NextResponse.json(
        { error: "Le service est en cours de démarrage. Réessayez dans 30 secondes." },
        { status: 503 }
      );
    }
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
