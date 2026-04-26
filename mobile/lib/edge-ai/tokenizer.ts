// Pure-TS WordPiece tokenizer matching HuggingFace BertTokenizer (uncased).
// Compatible with distilbert-base-uncased-* checkpoints.

const UNK = '[UNK]';
const CLS = '[CLS]';
const SEP = '[SEP]';
const PAD = '[PAD]';
const MAX_INPUT_CHARS_PER_WORD = 100;

const SPECIAL_TOKENS = new Set([CLS, SEP, PAD, UNK, '[MASK]']);

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\s/.test(ch);
}

function isControl(ch: string): boolean {
  if (ch === '\t' || ch === '\n' || ch === '\r') return false;
  const code = ch.charCodeAt(0);
  return (code >= 0 && code <= 0x1f) || code === 0x7f;
}

function isPunctuation(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (
    (code >= 33 && code <= 47) ||
    (code >= 58 && code <= 64) ||
    (code >= 91 && code <= 96) ||
    (code >= 123 && code <= 126)
  ) {
    return true;
  }
  return /[\p{P}]/u.test(ch);
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function cleanText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code === 0 || code === 0xfffd || isControl(ch)) continue;
    out += isWhitespace(ch) ? ' ' : ch;
  }
  return out;
}

function whitespaceSplit(text: string): string[] {
  return text.trim().split(/\s+/).filter((t) => t.length > 0);
}

function splitOnPunctuation(token: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of token) {
    if (isPunctuation(ch)) {
      if (current) {
        out.push(current);
        current = '';
      }
      out.push(ch);
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

function basicTokenize(text: string, doLowerCase: boolean, doStripAccents: boolean): string[] {
  const cleaned = cleanText(text);
  const splits = whitespaceSplit(cleaned);
  const out: string[] = [];
  for (let token of splits) {
    if (doLowerCase) token = token.toLowerCase();
    if (doStripAccents) token = stripAccents(token);
    for (const piece of splitOnPunctuation(token)) {
      if (piece.length > 0) out.push(piece);
    }
  }
  return out;
}

export interface TokenizerOptions {
  doLowerCase?: boolean;
  doStripAccents?: boolean;
}

export class WordPieceTokenizer {
  private readonly vocab: Map<string, number>;
  private readonly clsId: number;
  private readonly sepId: number;
  private readonly padId: number;
  private readonly unkId: number;
  private readonly doLowerCase: boolean;
  private readonly doStripAccents: boolean;

  constructor(vocab: Map<string, number>, options: TokenizerOptions = {}) {
    this.vocab = vocab;
    // Defaults match BertTokenizer for `*-cased` checkpoints (multilingual cased): no lowercase, no accent strip.
    this.doLowerCase = options.doLowerCase ?? false;
    this.doStripAccents = options.doStripAccents ?? false;
    this.clsId = this.requireToken(CLS);
    this.sepId = this.requireToken(SEP);
    this.padId = this.requireToken(PAD);
    this.unkId = this.requireToken(UNK);
  }

  private requireToken(token: string): number {
    const id = this.vocab.get(token);
    if (id === undefined) {
      throw new Error(`Vocab missing required special token: ${token}`);
    }
    return id;
  }

  private wordpiece(token: string): string[] {
    if (token.length > MAX_INPUT_CHARS_PER_WORD) return [UNK];
    const sub: string[] = [];
    let start = 0;
    while (start < token.length) {
      let end = token.length;
      let curSubstr: string | null = null;
      while (start < end) {
        let substr = token.slice(start, end);
        if (start > 0) substr = '##' + substr;
        if (this.vocab.has(substr)) {
          curSubstr = substr;
          break;
        }
        end -= 1;
      }
      if (curSubstr === null) return [UNK];
      sub.push(curSubstr);
      start = end;
    }
    return sub;
  }

  tokenize(text: string): string[] {
    const out: string[] = [];
    for (const token of basicTokenize(text, this.doLowerCase, this.doStripAccents)) {
      if (SPECIAL_TOKENS.has(token)) {
        out.push(token);
        continue;
      }
      for (const piece of this.wordpiece(token)) out.push(piece);
    }
    return out;
  }

  encodeSingle(
    text: string,
    maxLength = 512
  ): { input_ids: Int32Array; attention_mask: Int32Array } {
    const tokens = this.tokenize(text);
    const overhead = 2; // [CLS] X [SEP]
    const trunc = tokens.slice(0, Math.max(0, maxLength - overhead));
    const all = [CLS, ...trunc, SEP];
    const ids = this.convertTokensToIds(all);
    const len = ids.length;
    const input_ids = new Int32Array(len);
    const attention_mask = new Int32Array(len);
    for (let i = 0; i < len; i++) {
      input_ids[i] = ids[i];
      attention_mask[i] = 1;
    }
    return { input_ids, attention_mask };
  }

  convertTokensToIds(tokens: string[]): number[] {
    return tokens.map((t) => this.vocab.get(t) ?? this.unkId);
  }

  encodePair(
    textA: string,
    textB: string,
    maxLength = 512
  ): { input_ids: Int32Array; attention_mask: Int32Array } {
    const a = this.tokenize(textA);
    const b = this.tokenize(textB);
    const overhead = 3; // [CLS] A [SEP] B [SEP]
    let aBudget = maxLength - overhead - b.length;
    if (aBudget < 0) aBudget = 0;
    const aTrunc = a.slice(0, aBudget);
    const bBudget = maxLength - overhead - aTrunc.length;
    const bTrunc = b.slice(0, Math.max(0, bBudget));

    const tokens: string[] = [CLS, ...aTrunc, SEP, ...bTrunc, SEP];
    const ids = this.convertTokensToIds(tokens);
    const len = ids.length;
    const input_ids = new Int32Array(len);
    const attention_mask = new Int32Array(len);
    for (let i = 0; i < len; i++) {
      input_ids[i] = ids[i];
      attention_mask[i] = 1;
    }
    return { input_ids, attention_mask };
  }
}

export function parseVocab(raw: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = raw.split(/\r?\n/);
  let idx = 0;
  for (const line of lines) {
    if (line.length === 0 && idx === lines.length - 1) break;
    map.set(line, idx);
    idx += 1;
  }
  return map;
}
