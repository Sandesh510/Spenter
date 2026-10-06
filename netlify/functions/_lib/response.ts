export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface FunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function json(statusCode: number, body: unknown): FunctionResponse {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

/** Maps thrown errors to responses. Internal details are logged, never returned. */
export function fail(err: unknown): FunctionResponse {
  if (err instanceof HttpError) return json(err.status, { error: err.message });
  console.error(err);
  return json(500, { error: 'Internal error' });
}

/** Parses a JSON body and checks required string fields. */
export function readBody(raw: string | null | undefined, fields: string[]): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '{}');
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = obj[f];
    if (typeof v !== 'string' || v.trim() === '') throw new HttpError(400, `Missing field: ${f}`);
    out[f] = v;
  }
  return out;
}
