// Запись NBT в формате Bedrock (little-endian), как в .mcstructure.
// Значения задаются через T.*: T.int(5), T.string('x'), T.list(TYPE.COMPOUND, [...]).
'use strict';

const TYPE = { END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6, STRING: 8, LIST: 9, COMPOUND: 10 };

const T = {
  byte: (v) => ({ t: TYPE.BYTE, v: v ? (v === true ? 1 : v) : 0 }),
  short: (v) => ({ t: TYPE.SHORT, v }),
  int: (v) => ({ t: TYPE.INT, v }),
  long: (v) => ({ t: TYPE.LONG, v: BigInt(v) }),
  float: (v) => ({ t: TYPE.FLOAT, v }),
  string: (v) => ({ t: TYPE.STRING, v: String(v) }),
  list: (et, v) => ({ t: TYPE.LIST, et, v }),
  compound: (v) => ({ t: TYPE.COMPOUND, v }),
};

class Writer {
  constructor() { this.chunks = []; }
  u8(n) { const b = Buffer.alloc(1); b.writeUInt8(n); this.chunks.push(b); }
  i8(n) { const b = Buffer.alloc(1); b.writeInt8(n); this.chunks.push(b); }
  i16(n) { const b = Buffer.alloc(2); b.writeInt16LE(n); this.chunks.push(b); }
  i32(n) { const b = Buffer.alloc(4); b.writeInt32LE(n); this.chunks.push(b); }
  i64(n) { const b = Buffer.alloc(8); b.writeBigInt64LE(n); this.chunks.push(b); }
  f32(n) { const b = Buffer.alloc(4); b.writeFloatLE(n); this.chunks.push(b); }
  str(s) { const b = Buffer.from(s, 'utf8'); this.i16(b.length); this.chunks.push(b); }
  payload(tag) {
    switch (tag.t) {
      case TYPE.BYTE: return this.i8(tag.v);
      case TYPE.SHORT: return this.i16(tag.v);
      case TYPE.INT: return this.i32(tag.v);
      case TYPE.LONG: return this.i64(tag.v);
      case TYPE.FLOAT: return this.f32(tag.v);
      case TYPE.STRING: return this.str(tag.v);
      case TYPE.LIST:
        this.u8(tag.et);
        this.i32(tag.v.length);
        for (const item of tag.v) this.payload(item.t === undefined ? { t: tag.et, v: item } : item);
        return;
      case TYPE.COMPOUND:
        for (const [k, v] of Object.entries(tag.v)) {
          if (v === undefined) continue;
          this.u8(v.t);
          this.str(k);
          this.payload(v);
        }
        return this.u8(TYPE.END);
      default:
        throw new Error('Неизвестный тип NBT: ' + tag.t);
    }
  }
  root(tag) {
    this.u8(TYPE.COMPOUND);
    this.str('');
    this.payload(tag);
    return Buffer.concat(this.chunks);
  }
}

// Обычный JS-объект состояний блока → NBT: строки, числа (int), логические (byte).
function states(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'boolean' ? T.byte(v ? 1 : 0) : typeof v === 'number' ? T.int(v) : T.string(v);
  }
  return T.compound(out);
}

module.exports = { TYPE, T, Writer, states, encode: (tag) => new Writer().root(tag) };
