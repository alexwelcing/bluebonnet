import { describe, expect, it } from 'vitest';
import shotlist from '../content/shotlist.json';

// B7 density prep (Agent C): the NEXT density tranches per act are authored as
// fully-specified PENDING shotlist entries so generation + wiring can run the
// moment the FAL budget returns. These shots are SPEC ONLY — they reference no
// runtime assets yet, so this suite deliberately does NOT assert that the nodes
// exist in content/act*.json. Node wiring is deferred to generation time and is
// gated separately by the per-act density suites once the plates exist.

type Shot = {
  act?: string;
  nodeId?: string;
  tranche?: string;
  densityIntent?: string;
  window?: string;
  filename?: string;
  prompt?: string;
  seed?: number;
  model?: string;
  status?: string;
};

const shots = shotlist.shots as Shot[];

const requiredNoText = 'no readable text, no lettering, no signage characters';

// Tokens that risk an A1 violation when requested as a POSITIVE subject (a
// generator rendering readable glyphs). The canon negation clauses
// ("no timestamp overlay", "no readable text, no lettering, no signage
// characters", "no legible numerals") intentionally contain these words as
// negations, which is correct and A1-safe. So each occurrence is a failure ONLY
// when it is not immediately negated by a preceding "no " / "without ". The
// helper below scans every occurrence and flags any un-negated one.
const bannedTokens = ['roman', 'numeral', 'numerals', 'timestamp', 'signage', 'handwriting', 'lettering'];

function findPositiveBannedToken(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  for (const token of bannedTokens) {
    const re = new RegExp(`(\\b\\w+\\b\\s+){0,2}\\b${token}\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(lower)) !== null) {
      const segment = match[0];
      // Negated occurrences are A1-safe: "no ...", "without ...", "not a ...".
      if (/(^|\s)(no|without|not)\b/.test(segment)) continue;
      return token;
    }
  }
  return null;
}

// The prep tranches authored by Agent C. Each entry must be present with both
// window variants and be well-formed and A1-safe.
const prepTranches: Record<string, { tranche: string; nodes: string[]; windows: [string, string] }> = {
  act1: {
    tranche: 'act1-density-2',
    windows: ['20:08-20:17', '20:17-20:26'],
    nodes: [
      'wagon-rear-facing',
      'mile-marker-look-down',
      'tipline-printer-closeup',
      'culvert-mouth-look-down',
      'shoulder-wide-facing',
    ],
  },
  act2: {
    tranche: 'act2-density-2',
    windows: ['20:08-20:17', '20:17-20:26'],
    nodes: [
      'field-row-right-facing',
      'field-clock-two-detail',
      'field-clock-seven-detail',
      'field-gate-look-up',
      'field-deep-facing',
    ],
  },
  act3: {
    tranche: 'act3-density-2',
    windows: ['20:17-20:26', '20:26-20:35'],
    nodes: [
      'culvert-throat-facing',
      'culvert-floor-look-down',
      'culvert-echo-facing',
      'recorder-nest-facing',
    ],
  },
};

// Some prep nodes intentionally appear in more than one tranche list above only
// if reused; flatten to the unique set of prep filenames for global checks.
function prepShotsForTranche(act: string, tranche: string): Shot[] {
  return shots.filter((shot) => shot.act === act && shot.tranche === tranche);
}

describe('B7 density-prep pending shotlist entries (Agent C)', () => {
  it('keeps the canon A1 clause registered for all acts', () => {
    expect(shotlist.a1Lint?.requiredClause).toBe(requiredNoText);
  });

  for (const [act, plan] of Object.entries(prepTranches)) {
    describe(`${act} ${plan.tranche}`, () => {
      it('authors both window variants for every planned density node', () => {
        for (const nodeId of plan.nodes) {
          for (const window of plan.windows) {
            const shot = shots.find(
              (candidate) =>
                candidate.act === act && candidate.tranche === plan.tranche && candidate.nodeId === nodeId && candidate.window === window,
            );
            expect(shot, `${act}/${nodeId} @ ${window}`).toBeTruthy();
          }
        }
      });

      it('marks every prep shot pending so the toolchain will generate it', () => {
        const trancheShots = prepShotsForTranche(act, plan.tranche);
        expect(trancheShots.length, `${act} ${plan.tranche} count`).toBe(plan.nodes.length * plan.windows.length);
        for (const shot of trancheShots) {
          expect(String(shot.status ?? ''), shot.filename).toContain('pending');
        }
      });

      it('specifies required generation fields on every prep shot', () => {
        for (const shot of prepShotsForTranche(act, plan.tranche)) {
          expect(shot.nodeId, shot.filename).toBeTruthy();
          expect(shot.window, shot.filename).toBeTruthy();
          expect(shot.filename, `${shot.nodeId} filename`).toMatch(/\.jpg$/);
          expect(typeof shot.seed, `${shot.filename} seed`).toBe('number');
          expect(Number.isFinite(shot.seed), `${shot.filename} seed finite`).toBe(true);
          expect(shot.model, `${shot.filename} model`).toBeTruthy();
          expect(shot.densityIntent, `${shot.filename} intent`).toBeTruthy();
        }
      });

      it('anchors every prep prompt to existing plates and stays A1-safe', () => {
        for (const shot of prepShotsForTranche(act, plan.tranche)) {
          const prompt = String(shot.prompt ?? '');
          expect(prompt, `${shot.filename} prompt`).toBeTruthy();
          // A7 plate-anchored, multi-reference edit.
          expect(prompt, `${shot.filename} plate-anchored`).toContain('multi-reference plate-anchored edit');
          expect(prompt, `${shot.filename} source plates`).toContain('source plates:');
          // A1 no-text clause present (also enforced by lint:shotlist).
          expect(prompt, `${shot.filename} A1 clause`).toContain(requiredNoText);
          // No legacy police framing (A6 reframe).
          expect(prompt, `${shot.filename} A6`).not.toMatch(/trooper|DPS|cruiser|patrol car/i);
          // No banned text-bearing positive subjects (negated occurrences are A1-safe).
          expect(findPositiveBannedToken(prompt), `${shot.filename} positive banned token`).toBeNull();
          // The empty-world / no-motion-car rejection-taxonomy guards.
          expect(prompt, `${shot.filename} empty world`).toMatch(/no humans|no people/);
          expect(prompt, `${shot.filename} car never moves`).toContain('no car movement');
        }
      });

      it('uses a distinct seed for every prep shot in the tranche', () => {
        const seeds = prepShotsForTranche(act, plan.tranche).map((shot) => shot.seed);
        expect(new Set(seeds).size, `${act} ${plan.tranche} unique seeds`).toBe(seeds.length);
      });
    });
  }

  it('uses globally unique filenames for every prep shot', () => {
    const prepFilenames = Object.entries(prepTranches).flatMap(([act, plan]) =>
      prepShotsForTranche(act, plan.tranche).map((shot) => shot.filename),
    );
    expect(new Set(prepFilenames).size).toBe(prepFilenames.length);
  });
});
