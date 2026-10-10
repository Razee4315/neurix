//! What this device can handle: memory and CPU layout.
//!
//! Used to pick how much context to allocate and how many threads to run,
//! and reported to the UI so the store can say which models fit.

use std::fs;

/// Physical RAM in bytes, when the platform exposes it. `None` means
/// unknown — callers must not treat that as "too little".
pub fn total_memory_bytes() -> Option<u64> {
    // Android and Linux expose RAM through procfs. Other platforms report
    // unknown rather than pulling in a system-info dependency.
    fs::read_to_string("/proc/meminfo").ok().and_then(|text| parse_mem_total(&text))
}

/// Parse the `MemTotal` line of `/proc/meminfo` ("MemTotal:  8040348 kB").
fn parse_mem_total(meminfo: &str) -> Option<u64> {
    meminfo
        .lines()
        .find(|line| line.starts_with("MemTotal:"))?
        .split_whitespace()
        .nth(1)?
        .parse::<u64>()
        .ok()
        .map(|kb| kb * 1024)
}

/// Read one number per CPU core from sysfs (`cpu0/<leaf>`, `cpu1/<leaf>`, …).
/// Empty where the kernel does not expose it (Windows, macOS).
fn per_core(leaf: &str) -> Vec<u64> {
    let mut values = Vec::new();
    for cpu in 0..64 {
        let path = format!("/sys/devices/system/cpu/cpu{cpu}/{leaf}");
        match fs::read_to_string(&path).ok().and_then(|s| s.trim().parse::<u64>().ok()) {
            Some(value) => values.push(value),
            None => break,
        }
    }
    values
}

/// How many threads inference should use.
///
/// Phone chips mix fast and slow cores. A thread that lands on a slow core
/// holds the others back (every thread must finish its share of each layer),
/// so only the fast cores are counted. Desktop CPUs report twice as many
/// logical cores as physical ones; the extra hyper-threads do not help
/// matrix maths either.
pub fn inference_threads() -> u32 {
    let logical = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    // `cpu_capacity` is the scheduler's own measure of how strong each core
    // is; clock speed is the fallback on kernels that do not publish it.
    let capacity = per_core("cpu_capacity");
    if !capacity.is_empty() {
        return threads_for(&capacity, 60, logical);
    }
    threads_for(&per_core("cpufreq/cpuinfo_max_freq"), 75, logical)
}

/// Count the cores whose strength is at least `percent` of the strongest.
fn threads_for(strengths: &[u64], percent: u64, logical_cores: usize) -> u32 {
    let Some(strongest) = strengths.iter().copied().max() else {
        // No per-core table (Windows, macOS): assume hyper-threading.
        return (logical_cores / 2).clamp(2, 8) as u32;
    };
    let fast = strengths.iter().filter(|s| **s * 100 >= strongest * percent).count();
    // Leave a little headroom on phones: all-out use of every big core
    // heats the chip into throttling within a few replies.
    fast.clamp(2, 6) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_mem_total() {
        let sample = "MemTotal:        8040348 kB\nMemFree:          123456 kB\n";
        assert_eq!(parse_mem_total(sample), Some(8_040_348 * 1024));
    }

    #[test]
    fn missing_line_is_unknown() {
        assert_eq!(parse_mem_total("MemFree: 1 kB\n"), None);
    }

    #[test]
    fn only_fast_cores_are_used_on_phones() {
        // Scheduler capacities: 4 efficiency + 3 performance + 1 prime.
        let flagship = [280, 280, 280, 280, 820, 820, 820, 1024];
        assert_eq!(threads_for(&flagship, 60, 8), 4);

        // 6 performance + 2 prime, no efficiency cores at all.
        let all_big = [850, 850, 850, 850, 850, 850, 1024, 1024];
        assert_eq!(threads_for(&all_big, 60, 8), 6);

        // 6 little + 2 big budget chip.
        let budget = [300, 300, 300, 300, 300, 300, 1024, 1024];
        assert_eq!(threads_for(&budget, 60, 8), 2);

        // Clock-speed fallback, same flagship layout.
        let freqs = [1_800_000, 1_800_000, 1_800_000, 1_800_000, 2_500_000, 2_500_000, 2_500_000, 3_000_000];
        assert_eq!(threads_for(&freqs, 75, 8), 4);
    }

    #[test]
    fn desktops_use_physical_cores() {
        assert_eq!(threads_for(&[], 60, 8), 4);
        assert_eq!(threads_for(&[], 60, 32), 8);
        assert_eq!(threads_for(&[], 60, 2), 2);
    }
}
