import {
	userDb,
	WORD_BUDDY_USER_DB_NAME,
} from "../background/wordbook/database";

// Rejects on "blocked" instead of waiting, so a test that leaves a connection
// open fails right away rather than timing out.
async function deleteIndexedDatabase(databaseName: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(databaseName);
		request.onsuccess = (): void => {
			resolve();
		};
		request.onerror = (): void => {
			reject(request.error ?? new Error("Failed to delete test database."));
		};
		request.onblocked = (): void => {
			reject(new Error(`Deleting ${databaseName} was blocked.`));
		};
	});
}

// Callers close any other connections they opened before calling this.
export async function deleteWordBuddyDatabase(): Promise<void> {
	userDb.close();
	await deleteIndexedDatabase(WORD_BUDDY_USER_DB_NAME);
}
