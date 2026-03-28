const fs = require('fs');

const traceFile = 'c:/dev/worldwideview/artifacts/performance/Trace-20260328T153230.json';
console.log(`Analyzing ${traceFile}...`);

const data = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(data) ? data : data.traceEvents;

if (!events) {
    console.error("Invalid trace format.");
    process.exit(1);
}

const stats = {};
const stack = [];

// For ph === 'X' events, duration is 'dur' in microseconds
// For 'B' and 'E', compute from 'ts'
for (const ev of events) {
    if (ev.ph === 'X') {
        // Complete event
        const dur = ev.dur || 0;
        if (!stats[ev.name]) stats[ev.name] = { total: 0, count: 0 };
        stats[ev.name].total += dur;
        stats[ev.name].count += 1;
    } else if (ev.ph === 'B') {
        // Begin event
        stack.push({ name: ev.name, ts: ev.ts });
    } else if (ev.ph === 'E') {
        // End event
        const start = stack.pop();
        if (start && start.name === ev.name) {
            const dur = ev.ts - start.ts;
            if (!stats[ev.name]) stats[ev.name] = { total: 0, count: 0 };
            stats[ev.name].total += dur;
            stats[ev.name].count += 1;
        }
    }
}

const sorted = Object.keys(stats)
    .map(name => ({
        name,
        totalMs: stats[name].total / 1000,
        count: stats[name].count,
        avgMs: (stats[name].total / stats[name].count) / 1000
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 30);

console.log("\nTop 30 Most Expensive Operations:");
console.table(sorted);
