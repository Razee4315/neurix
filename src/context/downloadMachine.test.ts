import type { DownloadEvent, ModelInfo } from "@/services/types";
import { describe, expect, it } from "vitest";
import {
	type DownloadAction,
	type DownloadsState,
	MESSAGES,
	downloadsReducer,
	initialDownloads,
	toDownloadState,
	toLaunch,
} from "./downloadMachine";

function model(id = "m1"): ModelInfo {
	return {
		id,
		name: `Model ${id}`,
		description: "",
		size_bytes: 1000,
		size_label: "1 KB",
		tag: "Fast",
		hf_repo: "",
		hf_filename: "",
		context_length: 4096,
		company: "",
		parameters: "",
		quantization: "",
		best_for: [],
		min_ram_gb: 1,
		quality: 1,
		speed: 1,
		reasoning: "none",
		released: "2026-01",
		legacy: false,
	};
}

function run(...actions: DownloadAction[]): DownloadsState {
	return actions.reduce(downloadsReducer, initialDownloads);
}

const entry = (s: DownloadsState, id = "m1") => s.entries[id];
const view = (s: DownloadsState, id = "m1") => toDownloadState(s.entries[id]);
const native = (s: DownloadsState, event: DownloadEvent, id = "m1"): DownloadAction => ({
	type: "NATIVE",
	modelId: id,
	attempt: s.entries[id].attempt,
	event,
});

/** START then checks passed: a native transfer is running. */
function downloading(id = "m1"): DownloadsState {
	const s = run({ type: "START", model: model(id) });
	return downloadsReducer(s, { type: "CHECKS_PASSED", modelId: id, attempt: entry(s, id).attempt });
}

describe("download machine: current behaviour", () => {
	it("starts in checking, shown as downloading, and asks to be launched once", () => {
		const s = run({ type: "START", model: model() });
		expect(entry(s).phase).toEqual({ kind: "checking" });
		expect(view(s).status).toBe("downloading");
		expect(toLaunch(s, new Map())).toHaveLength(1);
		expect(toLaunch(s, new Map([["m1", entry(s).attempt]]))).toHaveLength(0);
	});

	it("a second start while running changes nothing", () => {
		const s = downloading();
		expect(downloadsReducer(s, { type: "START", model: model() })).toBe(s);
	});

	it("follows the native events to finished", () => {
		let s = downloading();
		s = downloadsReducer(s, native(s, { event: "Started", data: { total_bytes: 2000 } }));
		s = downloadsReducer(
			s,
			native(s, { event: "Progress", data: { bytes_downloaded: 500, total_bytes: 2000, speed_bps: 100 } }),
		);
		expect(view(s)).toMatchObject({ status: "downloading", downloadedBytes: 500, totalBytes: 2000, speedBps: 100 });
		s = downloadsReducer(s, native(s, { event: "Verifying" }));
		expect(view(s)).toMatchObject({ status: "verifying", speedBps: 0 });
		s = downloadsReducer(s, native(s, { event: "Finished" }));
		expect(view(s)).toMatchObject({ status: "finished", error: undefined });
	});

	it("a Failed event fails with its reason, and the later rejection keeps it", () => {
		let s = downloading();
		s = downloadsReducer(s, native(s, { event: "Failed", data: { error: "The connection stalled." } }));
		s = downloadsReducer(s, { type: "REJECTED", modelId: "m1", attempt: entry(s).attempt, error: "generic" });
		expect(view(s)).toMatchObject({ status: "failed", error: "The connection stalled." });
	});

	it("a rejection with no Failed event fails with the rejection text", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "REJECTED", modelId: "m1", attempt: entry(s).attempt, error: "already downloading" });
		expect(view(s)).toMatchObject({ status: "failed", error: "already downloading" });
	});

	it("pre-flight failures fail; the WiFi rule pauses with a way out", () => {
		const s = run({ type: "START", model: model() });
		const attempt = entry(s).attempt;
		expect(
			view(downloadsReducer(s, { type: "CHECK_FAILED", modelId: "m1", attempt, error: MESSAGES.noSpace })),
		).toMatchObject({ status: "failed", error: MESSAGES.noSpace, blockedByWifi: false });
		expect(
			view(downloadsReducer(s, { type: "CHECK_BLOCKED_BY_WIFI", modelId: "m1", attempt, message: MESSAGES.onMobileData })),
		).toMatchObject({ status: "paused", error: MESSAGES.onMobileData, blockedByWifi: true });
	});

	it("user pause: still downloading until the transfer stops, then paused with no message", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		expect(view(s)).toMatchObject({ status: "downloading", error: undefined });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(view(s)).toMatchObject({ status: "paused", error: undefined, blockedByWifi: false });
	});

	it("resume keeps the bytes already downloaded", () => {
		let s = downloading();
		s = downloadsReducer(
			s,
			native(s, { event: "Progress", data: { bytes_downloaded: 700, total_bytes: 1000, speed_bps: 5 } }),
		);
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		s = downloadsReducer(s, { type: "START", model: model() });
		expect(entry(s)).toMatchObject({ phase: { kind: "checking" }, downloadedBytes: 700, speedBps: 0 });
	});

	it("WiFi lost: says so at once, pauses, and resumes when WiFi is back", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "WIFI_LOST" });
		expect(view(s)).toMatchObject({ status: "downloading", error: MESSAGES.wifiLost });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(view(s)).toMatchObject({ status: "paused", error: MESSAGES.wifiLost });
		s = downloadsReducer(s, { type: "WIFI_BACK" });
		expect(entry(s).phase).toEqual({ kind: "checking" });
	});

	it("WiFi lost leaves a download the user allowed on mobile data alone", () => {
		let s = run({ type: "START", model: model(), allowMobileData: true });
		s = downloadsReducer(s, { type: "CHECKS_PASSED", modelId: "m1", attempt: entry(s).attempt });
		expect(downloadsReducer(s, { type: "WIFI_LOST" })).toBe(s);
	});

	it("WiFi back does not restart a download the user paused", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(downloadsReducer(s, { type: "WIFI_BACK" })).toBe(s);
	});

	it("a finished download forgets the mobile-data permission", () => {
		let s = run({ type: "START", model: model(), allowMobileData: true });
		s = downloadsReducer(s, { type: "CHECKS_PASSED", modelId: "m1", attempt: entry(s).attempt });
		s = downloadsReducer(s, native(s, { event: "Finished" }));
		expect(entry(s).allowMobileData).toBe(false);
	});

	it("restores partial files as paused without overwriting live entries", () => {
		let s = downloading("live");
		s = downloadsReducer(s, {
			type: "RESTORE",
			partials: [
				{ model: model("old"), totalBytes: 1000, downloadedBytes: 400 },
				{ model: model("live"), totalBytes: 1, downloadedBytes: 1 },
			],
		});
		expect(view(s, "old")).toMatchObject({ status: "paused", downloadedBytes: 400, error: undefined });
		expect(entry(s, "live").phase.kind).toBe("downloading");
	});

	it("cancel and remove forget the entry", () => {
		expect(downloadsReducer(downloading(), { type: "CANCEL", modelId: "m1" }).entries).toEqual({});
		expect(downloadsReducer(downloading(), { type: "REMOVE", modelId: "m1" }).entries).toEqual({});
	});
});

describe("download machine: fixed bugs", () => {
	it("cancel during the checks stops the download from starting", () => {
		let s = run({ type: "START", model: model() });
		const attempt = entry(s).attempt;
		s = downloadsReducer(s, { type: "CANCEL", modelId: "m1" });
		// The checks finish after the cancel: nothing comes back.
		s = downloadsReducer(s, { type: "CHECKS_PASSED", modelId: "m1", attempt });
		expect(s.entries).toEqual({});
	});

	it("cancel then start again: the old checks cannot move the new attempt", () => {
		let s = run({ type: "START", model: model() });
		const old = entry(s).attempt;
		s = downloadsReducer(s, { type: "CANCEL", modelId: "m1" });
		s = downloadsReducer(s, { type: "START", model: model() });
		expect(entry(s).attempt).not.toBe(old);
		s = downloadsReducer(s, { type: "CHECK_FAILED", modelId: "m1", attempt: old, error: "stale" });
		expect(entry(s).phase).toEqual({ kind: "checking" });
	});

	it("pause during the checks pauses instead of being ignored", () => {
		let s = run({ type: "START", model: model() });
		const attempt = entry(s).attempt;
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		expect(view(s).status).toBe("paused");
		// The checks resolve later and must not start the transfer.
		expect(downloadsReducer(s, { type: "CHECKS_PASSED", modelId: "m1", attempt })).toBe(s);
	});

	it("WiFi back while the pause is still stopping resumes instead of being dropped", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "WIFI_LOST" });
		s = downloadsReducer(s, { type: "WIFI_BACK" });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(entry(s).phase).toEqual({ kind: "checking" });
		expect(toLaunch(s, new Map())).toHaveLength(1);
	});

	it("start while a user pause is stopping resumes once it has stopped", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		s = downloadsReducer(s, { type: "START", model: model() });
		expect(entry(s).phase).toEqual({ kind: "pausing", reason: "user", resume: true });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(entry(s).phase).toEqual({ kind: "checking" });
	});

	it("a user pause cancels a queued automatic resume", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "WIFI_LOST" });
		s = downloadsReducer(s, { type: "WIFI_BACK" });
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		expect(view(s).status).toBe("paused");
	});

	it("a removed download is never resumed by WiFi coming back", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "WIFI_LOST" });
		s = downloadsReducer(s, native(s, { event: "Failed", data: { error: "interrupted" } }));
		s = downloadsReducer(s, { type: "REMOVE", modelId: "m1" });
		expect(downloadsReducer(s, { type: "WIFI_BACK" }).entries).toEqual({});
	});

	it("a transfer broken by the WiFi loss still resumes when WiFi is back", () => {
		let s = downloading();
		s = downloadsReducer(s, { type: "WIFI_LOST" });
		s = downloadsReducer(s, native(s, { event: "Failed", data: { error: "Download interrupted." } }));
		expect(view(s)).toMatchObject({ status: "paused", error: MESSAGES.wifiLost });
		expect(entry(downloadsReducer(s, { type: "WIFI_BACK" })).phase.kind).toBe("checking");
	});

	it("events from an older attempt are ignored", () => {
		let s = downloading();
		const old = entry(s).attempt;
		s = downloadsReducer(s, { type: "PAUSE", modelId: "m1" });
		s = downloadsReducer(s, native(s, { event: "Cancelled" }));
		s = downloadsReducer(s, { type: "START", model: model() });
		const stale: DownloadAction = { type: "NATIVE", modelId: "m1", attempt: old, event: { event: "Finished" } };
		expect(downloadsReducer(s, stale)).toBe(s);
	});

	it("attempt numbers are never reused, even after an entry is forgotten", () => {
		let s = run({ type: "START", model: model() });
		const first = entry(s).attempt;
		s = downloadsReducer(s, { type: "CANCEL", modelId: "m1" });
		s = downloadsReducer(s, { type: "START", model: model() });
		expect(entry(s).attempt).toBeGreaterThan(first);
	});
});
