import http from "http";
import { corsHeaders } from "./cors";

export function createHttpServer(allowedOrigins: string[]): http.Server {
  return http.createServer((req, res) => {
    const cors = corsHeaders(req, allowedOrigins);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...cors,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Accept",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }
    if (req.url === "/" || req.url === "") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...cors,
      });
      res.end(JSON.stringify({ server: "ok" }));
      return;
    }
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      ...cors,
    });
    res.end("not found");
  });
}
