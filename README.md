# @plurnk/plurnk-mimetypes-application-toml

`application/toml` AND `text/toml` mimetype handler for the [plurnk](https://github.com/plurnk) ecosystem.

## install

```
npm i @plurnk/plurnk-mimetypes-application-toml
```

## what it does

- `validate(content)` parses TOML via [`smol-toml`](https://www.npmjs.com/package/smol-toml) (zero deps, ~100KB) and throws on syntax errors.
- `extract(content)` emits a `field` symbol for every table header (including each segment of a dotted header like `[a.b.c]`) and every key-assignment, at every depth. Line numbers from a line-by-line source scan; the parsed object validates that any matched key is a real key.

## license

MIT.
