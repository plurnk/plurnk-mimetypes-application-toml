import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ApplicationToml from "./ApplicationToml.ts";

const metadata = {
    mimetype: "application/toml",
    glyph: "⚙️",
    extensions: [".toml"] as const,
};

const h = new ApplicationToml(metadata);

describe("ApplicationToml", () => {
    it("instantiates with metadata", () => {
        assert.equal(h.mimetype, "application/toml");
        assert.equal(h.glyph, "⚙️");
    });

    it("validate accepts well-formed TOML", () => {
        assert.doesNotThrow(() => h.validate('name = "plurnk"\nversion = "0.1.0"'));
        assert.doesNotThrow(() => h.validate("[server]\nport = 8080"));
        assert.doesNotThrow(() => h.validate(""));
    });

    it("validate throws on malformed TOML", () => {
        assert.throws(() => h.validate("key = "));
        assert.throws(() => h.validate("[unclosed"));
        assert.throws(() => h.validate('name = "unterminated'));
    });

    it("extracts top-level assignment keys", () => {
        const result = h.extractRaw('name = "plurnk"\nversion = "0.1.0"');
        const names = result.map((s) => s.name);
        assert.ok(names.includes("name"));
        assert.ok(names.includes("version"));
    });

    it("extracts table headers as field symbols", () => {
        const src = [
            "[server]",
            "port = 8080",
            "",
            "[database]",
            "host = \"localhost\"",
        ].join("\n");
        const result = h.extractRaw(src);
        const names = result.map((s) => s.name);
        assert.ok(names.includes("server"));
        assert.ok(names.includes("port"));
        assert.ok(names.includes("database"));
        assert.ok(names.includes("host"));
    });

    it("emits each segment of a dotted table header", () => {
        const src = [
            "[servers.production]",
            'host = "prod.example.com"',
        ].join("\n");
        const result = h.extractRaw(src);
        const names = result.map((s) => s.name);
        assert.ok(names.includes("servers"));
        assert.ok(names.includes("production"));
        assert.ok(names.includes("host"));
    });

    it("handles array-of-tables headers ([[key]])", () => {
        const src = [
            "[[users]]",
            'name = "alice"',
            "[[users]]",
            'name = "bob"',
        ].join("\n");
        const result = h.extractRaw(src);
        const names = result.map((s) => s.name);
        assert.ok(names.includes("users"));
        assert.equal(names.filter((n) => n === "name").length, 2);
    });

    it("assigns line numbers from the source scan", () => {
        const src = [
            "# leading comment",
            'first = "a"',
            "",
            'second = "b"',
        ].join("\n");
        const result = h.extractRaw(src);
        const byName = new Map(result.map((s) => [s.name, s.line]));
        assert.equal(byName.get("first"), 2);
        assert.equal(byName.get("second"), 4);
    });

    it("extract is non-throwing on malformed TOML (validate is the throwing path)", () => {
        assert.deepEqual(h.extractRaw("key = "), []);
    });

    it("returns empty array for empty input", () => {
        assert.deepEqual(h.extractRaw(""), []);
    });
});

describe("ApplicationToml — query (jsonpath against parsed TOML)", () => {
    const src = [
        'version = "0.6.0"',
        "",
        "[users.alice]",
        'role = "admin"',
        "",
        "[users.bob]",
        'role = "user"',
    ].join("\n");

    it("queries the parsed value directly", async () => {
        const out = await h.query(src, "jsonpath", "$.users.alice.role");
        assert.equal(out.length, 1);
        assert.equal(out[0].matched, "admin");
    });

    it("returns lines defaulting to 1 (smol-toml has no position tracking)", async () => {
        const out = await h.query(src, "jsonpath", "$.version");
        assert.equal(out.length, 1);
        assert.equal(out[0].matched, "0.6.0");
        assert.equal(out[0].line, 1);
    });

    it("throws QueryParseFailureError on malformed TOML", async () => {
        await assert.rejects(
            async () => { await h.query("key = ", "jsonpath", "$.x"); },
            (err: unknown) => err instanceof Error && err.name === "QueryParseFailureError",
        );
    });

    it("inherits regex against the raw TOML source (positions available there)", async () => {
        const out = await h.query(src, "regex", "role = \"(\\w+)\"");
        assert.equal(out.length, 2);
        assert.deepEqual(out[0].matched, ["admin"]);
        assert.equal(out[0].line, 4);
    });
});
