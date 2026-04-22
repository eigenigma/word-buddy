import { z } from "zod";

export interface SiteControlState {
	readonly blockedHosts: readonly string[];
}

function isCanonicalHost(host: string): boolean {
	return normalizeHostInput(host) === host;
}

export const EMPTY_SITE_CONTROL_STATE: SiteControlState = Object.freeze({
	blockedHosts: Object.freeze([]),
});

function normalizeHostname(hostname: string): string | null {
	const trimmedHostname = hostname.trim().toLowerCase();
	const withoutWww = trimmedHostname.replace(/^www\./u, "");
	if (
		withoutWww.length === 0 ||
		withoutWww.startsWith(".") ||
		withoutWww.endsWith(".") ||
		withoutWww.includes("..") ||
		!/^[a-z0-9.-]+$/u.test(withoutWww)
	) {
		return null;
	}

	return withoutWww;
}

function toUrlCandidate(input: string): string {
	return /^[a-z][a-z\d+.-]*:\/\//iu.test(input) ? input : `https://${input}`;
}

export function normalizeHostInput(input: string): string | null {
	const trimmedInput = input.trim();
	if (trimmedInput.length === 0) {
		return null;
	}

	try {
		const candidateUrl = toUrlCandidate(trimmedInput);
		const parsedUrl = new URL(candidateUrl);
		return normalizeHostname(parsedUrl.hostname);
	} catch {
		return null;
	}
}

const CanonicalHostSchema = z.string().refine(isCanonicalHost);

export const SiteControlStateSchema: z.ZodType<SiteControlState> = z
	.object({
		blockedHosts: z.array(CanonicalHostSchema).readonly(),
	})
	.readonly();

export function isHostBlocked(state: SiteControlState, host: string): boolean {
	const normalizedHost = normalizeHostInput(host);
	return normalizedHost === null
		? false
		: state.blockedHosts.includes(normalizedHost);
}
