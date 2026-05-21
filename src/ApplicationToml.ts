import { BaseHandler } from "@plurnk/plurnk-mimetypes";
import type { MimeSymbol } from "@plurnk/plurnk-mimetypes";
import { parse } from "smol-toml";

// application/toml + text/toml handler. Validates via smol-toml (zero deps,
// throws on malformed). Extracts keys from the parsed object by recursive
// walk; line numbers come from a source scan because smol-toml's parse
// doesn't expose per-node positions.
//
// TOML's syntax is line-based, which makes the scan reliable: keys appear at
// `[<table>]` headers or as `key = value` at the start of a line (modulo
// leading whitespace). Inline tables (`{ x = 1 }`) and arrays-of-tables are
// emitted as their containing-key symbols only — inline keys are not surfaced
// since the structural signal is the parent.
export default class ApplicationToml extends BaseHandler {
    validate(content: string): void {
        parse(content);
    }

    extract(content: string): MimeSymbol[] {
        let parsed: Record<string, unknown>;
        try {
            parsed = parse(content) as Record<string, unknown>;
        } catch {
            return [];
        }
        const validKeys = collectKeys(parsed);
        if (validKeys.size === 0) return [];
        return scanKeyLines(content, validKeys);
    }
}

// Recursively collect every key name appearing in the parsed object.
function collectKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
    if (typeof value !== "object" || value === null) return into;
    if (Array.isArray(value)) {
        for (const item of value) collectKeys(item, into);
        return into;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        into.add(key);
        collectKeys(child, into);
    }
    return into;
}

// Scan source line-by-line for keys-at-line-start: either `[<key>]` table
// headers (possibly dotted: `[a.b.c]`) or `<key> = ...` assignments. Each
// occurrence emits a field symbol at that line, provided the key (or its
// last dotted segment) is in the valid set.
const TABLE_HEADER = /^\s*\[\[?([^\]]+)\]\]?\s*$/;
const KEY_ASSIGN = /^\s*([A-Za-z0-9_-]+|"[^"]+"|'[^']+')\s*=/;

function scanKeyLines(content: string, validKeys: Set<string>): MimeSymbol[] {
    const symbols: MimeSymbol[] = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        // Trim trailing comment for matching cleanliness.
        const line = raw.replace(/\s+#.*$/, "");

        const headerMatch = TABLE_HEADER.exec(line);
        if (headerMatch !== null) {
            // Dotted header: emit one symbol per segment that matches a real key.
            const segments = headerMatch[1].split(".").map((s) => s.trim());
            for (const seg of segments) {
                const name = unquote(seg);
                if (validKeys.has(name)) {
                    symbols.push({ name, kind: "field", line: i + 1, endLine: i + 1 });
                }
            }
            continue;
        }

        const assignMatch = KEY_ASSIGN.exec(line);
        if (assignMatch !== null) {
            const name = unquote(assignMatch[1]);
            if (validKeys.has(name)) {
                symbols.push({ name, kind: "field", line: i + 1, endLine: i + 1 });
            }
        }
    }
    return symbols;
}

function unquote(s: string): string {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}
