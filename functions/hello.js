export async function onRequest(context) {
  const { request } = context;
  const clientIP = request.headers.get("CF-Connecting-IP") || "Unknown";
  const timestamp = new Date().toISOString();

  return new Response(JSON.stringify({
    message: "Art Allergy Monitoring Active",
    status: "Vandalism levels normal",
    metadata: {
      visitor_ip: clientIP,
      server_time: timestamp,
      office: "Art Allergy Registry"
    }
  }), {
    headers: {
      "Content-Type": "application/json",
      "X-Art-Allergy": "Detected"
    }
  });
}

