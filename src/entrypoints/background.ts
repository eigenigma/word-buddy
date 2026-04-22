import { createBackgroundServices } from "@/background/composition";
import { createMessageRouter } from "@/background/router";
import { reportGlobalError } from "@/shared/utils/errors";

function reportSeedError(error: unknown): void {
	reportGlobalError("word-buddy: static dictionary seed failed", error);
}

export default defineBackground(() => {
	const services = createBackgroundServices();
	const router = createMessageRouter(services);

	services.dictionarySeedService.ensureSeeded().catch(reportSeedError);

	browser.runtime.onMessage.addListener(router.handle);
});
