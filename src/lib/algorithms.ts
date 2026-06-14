export type AlgorithmResult = {
  name: string;
  startTime: string;
  endTime: string;
  totalTime: string;
};

function createDeck(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms3 = d.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms3}`;
}

function fisherYates(deck: number[], rand: () => number): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
}

function createXorshift32(seed?: number): () => number {
  let s = ((seed ?? Date.now()) >>> 0) || 1;
  return (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Translated from WELLRNG512a.c by Panneton, L'Ecuyer & Matsumoto
function createWELL512a(): () => number {
  const st = new Uint32Array(16);
  let idx = 0;
  for (let i = 0; i < 16; i++) {
    st[i] = (Math.random() * 4294967296) >>> 0;
  }
  return (): number => {
    const z0 = st[(idx + 15) & 15];
    const v0 = st[idx];
    const vm1 = st[(idx + 13) & 15];
    const vm2 = st[(idx + 9) & 15];
    const z1 = (v0 ^ (v0 << 16)) ^ (vm1 ^ (vm1 << 15));
    const z2 = vm2 ^ (vm2 >>> 11);
    const nv1 = z1 ^ z2;
    st[idx] = nv1;
    st[(idx + 15) & 15] =
      (z0 ^ (z0 << 2)) ^
      (z1 ^ (z1 << 18)) ^
      (z2 << 28) ^
      (nv1 ^ ((nv1 << 5) & 0xda442d24));
    idx = (idx + 15) & 15;
    return st[idx] * 2.3283064365386963e-10; // / 2^32
  };
}

function bench(name: string, rounds: number, rand: () => number): AlgorithmResult {
  const deck = createDeck();
  const wallStart = Date.now();
  const t0 = performance.now();
  for (let i = 0; i < rounds; i++) {
    fisherYates(deck, rand);
  }
  const t1 = performance.now();
  const wallEnd = Date.now();
  return {
    name,
    startTime: formatTimestamp(wallStart),
    endTime: formatTimestamp(wallEnd),
    totalTime: `${(t1 - t0).toFixed(3)} ms`,
  };
}

export const runJSRandom = (rounds: number) => bench("JS Random", rounds, Math.random);
export const runXorshift = (rounds: number) => bench("Xorshift", rounds, createXorshift32());
export const runWELL512a = (rounds: number) => bench("WELL512a", rounds, createWELL512a());
