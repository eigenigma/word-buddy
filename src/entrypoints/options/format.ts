const RAW_URL_MAX_LENGTH = 48;

function padTwoDigits(value: number): string {
	return value.toString().padStart(2, "0");
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength - 3)}...`;
}

export function formatTimestamp(timestampMs: number): string {
	const date = new Date(timestampMs);
	const year = date.getFullYear();
	const month = padTwoDigits(date.getMonth() + 1);
	const day = padTwoDigits(date.getDate());
	const hours = padTwoDigits(date.getHours());
	const minutes = padTwoDigits(date.getMinutes());

	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatSourceHost(url: string | null): string {
	if (url === null) {
		return "";
	}

	try {
		return new URL(url).host;
	} catch {
		return truncateText(url, RAW_URL_MAX_LENGTH);
	}
}
