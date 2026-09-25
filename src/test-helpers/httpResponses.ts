export function createJsonResponse(payload: unknown, status = 200): Response {
	return Response.json(payload, { status: status });
}

export function createTextResponse(
	body: string,
	status: number,
	headers: HeadersInit = {},
): Response {
	return new Response(body, { headers: headers, status: status });
}
