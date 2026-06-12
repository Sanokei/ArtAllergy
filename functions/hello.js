export async function onRequest(context) {
  const { request } = context;
  const clientIP = request.headers.get("CF-Connecting-IP") || "Unknown";
  const timestamp = new Date().toISOString();

  return new Response(JSON.stringify({
    message: "Art Allergy Publishing House API Active",
    status: "Submissions open for New York & London creators",
    metadata: {
      visitor_ip: clientIP,
      server_time: timestamp,
      office: "Art Allergy Editorial Desk",
      locations: ["New York", "London"]
    }
  }), {
    headers: {
      "Content-Type": "application/json",
      "X-Art-Allergy": "Detected"
    }
  });
}

