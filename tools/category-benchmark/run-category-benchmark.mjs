#!/usr/bin/env node

// Category Match Benchmark
// Compares categorizeTransaction output against ground-truth CSV.
// Run: node tools/category-benchmark/run-category-benchmark.mjs

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { categorizeTransaction } from '../../js/category-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, 'all_time_controle_de_gastos.csv');
const suffix = process.argv[2];
const now = new Date();
const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0')
].join('-');
const fileName = suffix
    ? `category-benchmark_${timestamp}_${suffix}.json`
    : `category-benchmark_${timestamp}.json`;
const JSON_OUTPUT_PATH = resolve(__dirname, fileName);

// --- CSV Parsing ---

function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    const dataLines = lines.slice(1);

    return dataLines.map(line => {
        const parts = [];
        let current = '';
        let inQuotes = false;

        for (const ch of line) {
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        parts.push(current.trim());

        return {
            date: parts[0] || '',
            description: parts[1] || '',
            expectedCategory: parts[2] || '',
            account: parts[3] || '',
            amount: parseFloat(parts[4]) || 0,
            type: parts[5] || 'expense'
        };
    }).filter(t => t.description && t.expectedCategory);
}

// --- Run Benchmark (black box: calls categorizeTransaction directly) ---

const csvContent = readFileSync(CSV_PATH, 'utf8');
const transactions = parseCSV(csvContent);

const matches = [];
const mismatches = [];
const semCategoria = [];

for (const txn of transactions) {
    const got = categorizeTransaction(txn.description, txn.type);

    if (got === txn.expectedCategory) {
        matches.push(txn);
    } else if (got === 'Sem Categoria') {
        semCategoria.push(txn);
    } else {
        mismatches.push({
            description: txn.description,
            expected: txn.expectedCategory,
            got,
            type: txn.type
        });
    }
}

const total = transactions.length;
const pct = (n) => (100 * n / total).toFixed(1) + '%';

// --- Mismatch Breakdown ---

function buildMismatchBreakdown(items) {
    const byRoute = {};
    for (const m of items) {
        const route = `${m.expected} → ${m.got}`;
        if (!byRoute[route]) {
            byRoute[route] = { count: 0, descriptions: [] };
        }
        byRoute[route].count++;
        byRoute[route].descriptions.push(m.description);
    }

    const sorted = Object.entries(byRoute)
        .sort((a, b) => b[1].count - a[1].count);

    return { sorted, byRoute };
}

// --- Sem Categoria Breakdown ---

function buildSemCategoriaBreakdown(items) {
    const byExpected = {};
    for (const s of items) {
        const cat = s.expectedCategory;
        if (!byExpected[cat]) {
            byExpected[cat] = [];
        }
        byExpected[cat].push(s.description);
    }

    const sorted = Object.entries(byExpected)
        .sort((a, b) => b[1].length - a[1].length);

    return { sorted, byExpected };
}

const mismatchBreakdown = buildMismatchBreakdown(mismatches);
const semCategoriaBreakdown = buildSemCategoriaBreakdown(semCategoria);

// --- Console Output ---

console.log('=== CATEGORY MATCH BENCHMARK ===');
console.log(`Source: ${CSV_PATH}`);
console.log(`Total: ${total}`);
console.log('');
console.log('SUMMARY');
console.log(`  Match:         ${String(matches.length).padStart(4)} (${pct(matches.length)})`);
console.log(`  Mismatch:      ${String(mismatches.length).padStart(4)} (${pct(mismatches.length)})`);
console.log(`  Sem Categoria: ${String(semCategoria.length).padStart(4)} (${pct(semCategoria.length)})`);

if (mismatches.length > 0) {
    console.log('');
    console.log('MISMATCH BREAKDOWN (expected → got)');
    console.log('─'.repeat(60));
    for (const [route, data] of mismatchBreakdown.sorted) {
        console.log(`  ${route} [${data.count}x]`);
        const samples = data.descriptions.slice(0, 5);
        for (const s of samples) {
            console.log(`    ${s}`);
        }
        if (data.descriptions.length > 5) {
            console.log(`    ... and ${data.descriptions.length - 5} more`);
        }
    }
}

if (semCategoria.length > 0) {
    console.log('');
    console.log('SEM CATEGORIA BREAKDOWN (by expected category)');
    console.log('─'.repeat(60));
    for (const [cat, descs] of semCategoriaBreakdown.sorted) {
        console.log(`  ${cat}: ${descs.length}`);
        const samples = descs.slice(0, 5);
        for (const s of samples) {
            console.log(`    ${s}`);
        }
        if (descs.length > 5) {
            console.log(`    ... and ${descs.length - 5} more`);
        }
    }
}

// --- JSON Output ---

const jsonResult = {
    timestamp: new Date().toISOString(),
    total,
    summary: {
        match: { count: matches.length, pct: pct(matches.length) },
        mismatch: { count: mismatches.length, pct: pct(mismatches.length) },
        semCategoria: { count: semCategoria.length, pct: pct(semCategoria.length) }
    },
    mismatches: {
        byRoute: Object.fromEntries(
            mismatchBreakdown.sorted.map(([route, data]) => [
                route,
                { count: data.count, samples: data.descriptions.slice(0, 10) }
            ])
        ),
        all: mismatches
    },
    semCategoria: {
        byExpectedCategory: Object.fromEntries(
            semCategoriaBreakdown.sorted.map(([cat, descs]) => [
                cat,
                { count: descs.length, samples: descs.slice(0, 10) }
            ])
        ),
        all: semCategoria.map(s => ({
            description: s.description,
            expected: s.expectedCategory,
            type: s.type
        }))
    }
};

writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonResult, null, 2));
console.log('');
console.log(`Results written to: ${JSON_OUTPUT_PATH}`);
