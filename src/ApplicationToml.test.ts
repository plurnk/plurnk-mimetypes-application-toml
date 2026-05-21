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
        const result = h.extract('name = "plurnk"\nversion = "0.1.0"');
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
        const result = h.extract(src);
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
        const result = h.extract(src);
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
        const result = h.extract(src);
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
        const result = h.extract(src);
        const byName = new Map(result.map((s) => [s.name, s.line]));
        assert.equal(byName.get("first"), 2);
        assert.equal(byName.get("second"), 4);
    });

    it("extract is non-throwing on malformed TOML (validate is the throwing path)", () => {
        assert.deepEqual(h.extract("key = "), []);
    });

    it("returns empty array for empty input", () => {
        assert.deepEqual(h.extract(""), []);
    });
});
