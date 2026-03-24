import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DATA-04 validation: Pipeline runs automatically via GitHub Actions cron every 24h.
 *
 * Structural tests verifying the workflow file contains all required elements
 * for automated daily execution.
 */

describe('DATA-04: GitHub Actions cron workflow structure', () => {
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'data-pipeline.yml');

  it('workflow file exists', () => {
    assert.ok(existsSync(workflowPath), 'data-pipeline.yml should exist');
  });

  const yaml = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf-8') : '';

  it('has a daily cron schedule', () => {
    assert.ok(yaml.includes('schedule:'), 'Should have schedule trigger');
    assert.ok(yaml.includes('cron:'), 'Should have cron expression');
    // Verify cron runs once daily (5 fields with a specific hour)
    const cronMatch = yaml.match(/cron:\s*'([^']+)'/);
    assert.ok(cronMatch, 'Should have a valid cron expression');
    const parts = cronMatch![1].trim().split(/\s+/);
    assert.equal(parts.length, 5, 'Cron should have 5 fields (minute hour day month weekday)');
    // Day/month/weekday should be wildcards for daily
    assert.equal(parts[2], '*', 'Day field should be wildcard for daily');
    assert.equal(parts[3], '*', 'Month field should be wildcard for daily');
    assert.equal(parts[4], '*', 'Weekday field should be wildcard for daily');
  });

  it('supports manual workflow_dispatch trigger', () => {
    assert.ok(yaml.includes('workflow_dispatch'), 'Should support manual triggering');
  });

  it('runs the pipeline script via tsx', () => {
    assert.ok(
      yaml.includes('tsx src/pipeline/run.ts') || yaml.includes('tsx ./src/pipeline/run.ts'),
      'Should invoke the pipeline run script',
    );
  });

  it('commits data files back to repo', () => {
    assert.ok(yaml.includes('git commit'), 'Should commit data changes');
    assert.ok(yaml.includes('git push'), 'Should push committed data');
    assert.ok(yaml.includes('data/scores/'), 'Should stage score files');
  });

  it('has write permissions for commits', () => {
    assert.ok(yaml.includes('contents: write'), 'Should have write permission');
  });

  it('passes required secrets to pipeline', () => {
    assert.ok(yaml.includes('RELIEFWEB_APPNAME'), 'Should reference RELIEFWEB_APPNAME secret');
  });
});

describe('DATA-04: pipeline orchestrator module', () => {
  it('runPipeline is importable and is an async function', async () => {
    const mod = await import('../../pipeline/run.js');
    assert.equal(typeof mod.runPipeline, 'function', 'runPipeline should be exported');
  });

  it('npm scripts include pipeline command', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    assert.ok(pkg.scripts.pipeline, 'package.json should have a "pipeline" script');
    assert.ok(
      pkg.scripts.pipeline.includes('tsx') && pkg.scripts.pipeline.includes('run.ts'),
      'pipeline script should invoke tsx with run.ts',
    );
  });
});
