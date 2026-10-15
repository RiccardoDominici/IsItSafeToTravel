/**
 * The consistency database's formula constraints (scripts/calibration/evaluate-consistency.ts):
 * bounds and orderings evaluated against a set of scores, grey places "not applicable".
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateConstraints, type Constraint } from '../../../../scripts/calibration/evaluate-consistency.js';
import { applyCorrections, buildConstraints, type DbFinding, type SwarmFinding } from '../../../../scripts/audit/assemble-consistency-db.js';

const scores = new Map<string, number | null>([
  ['AFG', 3.4],
  ['CHE', 8.7],
  ['ITA', 7.9],
  ['ALA', null],
]);
const c = (id: string, kind: Constraint['kind'], iso3: string, value: number | string): Constraint => ({ id, kind, iso3, value, rationale: '', finding: '' });

describe('consistency constraints', () => {
  it('bounds pass or fail with the shortfall in points', () => {
    const [ok, bad] = evaluateConstraints([c('a', 'score_at_most', 'AFG', 3.5), c('b', 'score_at_least', 'AFG', 4)], scores);
    assert.equal(ok.status, 'pass');
    assert.equal(ok.shortfall, 0);
    assert.equal(bad.status, 'fail');
    assert.ok(Math.abs((bad.shortfall ?? 0) - 0.6) < 1e-9);
  });

  it('orderings compare the two scores; a tie is a failure', () => {
    const [ok, bad, tie] = evaluateConstraints(
      [c('a', 'safer_than', 'CHE', 'ITA'), c('b', 'less_safe_than', 'CHE', 'ITA'), c('c', 'safer_than', 'ITA', 'ITA')],
      scores,
    );
    assert.equal(ok.status, 'pass');
    assert.equal(bad.status, 'fail');
    assert.equal(tie.status, 'fail');
  });

  it('a grey place (no official score) or an unknown one makes the constraint not applicable', () => {
    const r = evaluateConstraints([c('a', 'score_at_most', 'ALA', 5), c('b', 'safer_than', 'CHE', 'ALA'), c('c', 'score_at_least', 'XXX', 1)], scores);
    assert.deepEqual(r.map((x) => x.status), ['n/a', 'n/a', 'n/a']);
  });

  it('every constraint in the database is well formed and points at a finding', () => {
    const path = join(process.cwd(), 'scripts', 'calibration', 'consistency', 'constraints.json');
    const db = JSON.parse(readFileSync(path, 'utf-8')) as { constraints: Constraint[] };
    const ids = new Set<string>();
    for (const k of db.constraints) {
      assert.ok(!ids.has(k.id), `duplicate id ${k.id}`);
      ids.add(k.id);
      assert.match(k.iso3, /^[A-Z]{3}$/);
      if (k.kind === 'score_at_most' || k.kind === 'score_at_least') {
        assert.ok(typeof k.value === 'number' && k.value >= 1 && k.value <= 10, `${k.id}: bound on the 1-10 scale`);
      } else {
        assert.match(String(k.value), /^[A-Z]{3}$/, `${k.id}: ordering names another ISO3`);
      }
      assert.ok(k.rationale.length > 10 && k.finding.length > 0, `${k.id}: rationale and finding`);
    }
  });

  it('every constraint points at a confirmed finding of the database', () => {
    const dir = join(process.cwd(), 'scripts', 'calibration', 'consistency');
    const db = JSON.parse(readFileSync(join(dir, 'constraints.json'), 'utf-8')) as { constraints: Array<Constraint & { alsoFindings?: string[] }> };
    const findings = JSON.parse(readFileSync(join(dir, 'findings.json'), 'utf-8')) as { findings: Array<{ id: string; verdict: string; iso3: string }> };
    const byId = new Map(findings.findings.map((f) => [f.id, f]));
    assert.equal(byId.size, findings.findings.length, 'finding ids are unique');
    for (const k of db.constraints) {
      for (const id of [k.finding, ...(k.alsoFindings ?? [])]) {
        assert.equal(byId.get(id)?.verdict, 'confirmed', `${k.id}: ${id} is a confirmed finding`);
      }
    }
  });
});

describe('the issue list', () => {
  it('puts every kept finding in exactly one issue', () => {
    const dir = join(process.cwd(), 'scripts', 'calibration', 'consistency');
    const findings = JSON.parse(readFileSync(join(dir, 'findings.json'), 'utf-8')) as { findings: Array<{ id: string; verdict: string }> };
    const issues = JSON.parse(readFileSync(join(dir, 'issues.json'), 'utf-8')) as { issues: Array<{ id: string; findings: string[]; uncertainFindings: string[] }> };
    const verdict = new Map(findings.findings.map((f) => [f.id, f.verdict]));
    const seen = new Map<string, string>();
    for (const issue of issues.issues) {
      for (const id of issue.findings) {
        assert.ok(verdict.has(id), `${issue.id}: unknown finding ${id}`);
        assert.ok(!seen.has(id), `${id} is in ${seen.get(id)} and ${issue.id}`);
        seen.set(id, issue.id);
      }
      assert.deepEqual(issue.uncertainFindings, issue.findings.filter((id) => verdict.get(id) === 'uncertain'), `${issue.id}: uncertain list`);
    }
    assert.equal(seen.size, verdict.size, 'every kept finding belongs to an issue');
  });
});

describe('owner corrections', () => {
  const finding = (quote: string): SwarmFinding => ({
    iso3: 'ALL', lang: 'en', category: 'bad-comparison', severity: 'medium', field: 'COMPARISON TABLE', quote, problem: '', expected: '', batch: 'b.txt',
    verification: { verdict: 'confirmed', reason: 'looks wrong', category: 'bad-comparison', severity: 'medium', fixArea: 'comparisons', constraintKind: 'none', constraintValue: '' },
  });
  const correction = (quote: string) => ({ match: { batch: 'b.txt', iso3: 'ALL', lang: 'en', quote }, verdict: 'rejected' as const, reason: 'By design.', decidedOn: '2026-10-15' });

  it('override the verdict and keep the verifier note after the reason', () => {
    const [a, b] = applyCorrections([finding('x'), finding('y')], [correction('x')]);
    assert.equal(a.verification?.verdict, 'rejected');
    assert.match(a.verification?.reason ?? '', /^owner correction 2026-10-15: By design\. Verifier had said: looks wrong$/);
    assert.equal(b.verification?.verdict, 'confirmed');
  });

  it('fail loudly when a correction matches nothing', () => {
    assert.throws(() => applyCorrections([finding('x')], [correction('gone')]), /match no verified finding/);
  });
});

describe('building constraints from findings', () => {
  const f = (id: string, iso3: string, constraintKind: string, constraintValue: string, verdict: DbFinding['verdict'] = 'confirmed'): DbFinding => ({
    id, source: 'swarm', review: 'ordering', check: null, batch: null, iso3, lang: 'en', url: null, category: 'implausible-score', severity: 'high',
    field: 'SCORE', quote: '', problem: `rationale for ${id}`, expected: '', formulaRelevant: true, fixArea: 'formula', verdict, verification: '',
    constraintKind, constraintValue,
  });

  it('writes orderings as safer_than and merges the same ordering proposed twice', () => {
    const { constraints, merged } = buildConstraints([f('F1', 'SDN', 'less_safe_than', 'SSD'), f('F2', 'SSD', 'safer_than', 'sdn')]);
    assert.equal(merged, 1);
    assert.deepEqual(constraints.map((c) => [c.kind, c.iso3, c.value, c.finding]), [['safer_than', 'SSD', 'SDN', 'F1']]);
    assert.deepEqual((constraints[0] as { alsoFindings?: string[] }).alsoFindings, ['F2']);
  });

  it('keeps the looser of two bounds on one place, and ignores unconfirmed or malformed ones', () => {
    const { constraints } = buildConstraints([
      f('F1', 'BLR', 'score_at_most', '5.0'), f('F2', 'BLR', 'score_at_most', '5.5'), f('F3', 'CPV', 'score_at_least', '7'),
      f('F4', 'CUB', 'score_at_most', '6', 'uncertain'), f('F5', 'PNG', 'score_at_most', '11'), f('F6', 'JPN', 'safer_than', 'Italy'), f('F7', 'ALL', 'score_at_most', '5'),
    ]);
    assert.deepEqual(constraints.map((c) => [c.iso3, c.kind, c.value, c.finding]), [['BLR', 'score_at_most', 5.5, 'F2'], ['CPV', 'score_at_least', 7, 'F3']]);
  });

  it('drops contradictions instead of keeping a database that disagrees with itself', () => {
    const { constraints, conflicts } = buildConstraints([
      f('F1', 'JPN', 'safer_than', 'ITA'), f('F2', 'ITA', 'safer_than', 'JPN'),
      f('F3', 'CUB', 'score_at_most', '5.5'), f('F4', 'CUB', 'score_at_least', '6'), f('F5', 'TWN', 'score_at_least', '7.5'),
    ]);
    assert.deepEqual(constraints.map((c) => c.iso3), ['TWN']);
    assert.equal(conflicts.length, 2);
  });
});
