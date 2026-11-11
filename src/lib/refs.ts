export const validRef = (r: unknown): r is string => typeof r === "string" &&
  (/^local:drafts\/[0-9a-f-]{36}\/[a-z.]+$/.test(r) || /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/drafts\//.test(r));
