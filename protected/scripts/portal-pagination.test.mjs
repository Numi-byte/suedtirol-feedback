import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPortalPage, requestedPage } from '../src/lib/portal-pagination.ts';
import { reportedIssueLabel } from '../src/lib/reported-issues.ts';
import { feedbackCategoryLabels } from '../../shared/feedback-categories.ts';

test('navigation through a large database transfers only the requested ten rows', async () => {
  const calls = [];
  const page = await loadPortalPage(307, 10, async (from, to) => {
    calls.push([from, to]);
    return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), count: 20000, error: null };
  }, () => { throw new Error('A normal page must not run a second count query'); });
  assert.deepEqual(calls, [[3060, 3069]]);
  assert.deepEqual(page.rows, Array.from({ length: 10 }, (_, i) => 3060 + i));
  assert.equal(page.pageCount, 2000);
});

test('a filter that removes the last page recovers from PostgREST range errors', async () => {
  const calls = [];
  const page = await loadPortalPage(8, 10, async (from, to) => {
    calls.push([from, to]);
    return from > 12 ? { data: null, count: null, error: { code: 'PGRST103', message: 'Range not satisfiable' } }
      : { data: [10, 11, 12], count: 13, error: null };
  }, async () => ({ count: 13, error: null }));
  assert.equal(page.currentPage, 2);
  assert.deepEqual(page.rows, [10, 11, 12]);
  assert.deepEqual(calls, [[70, 79], [10, 19]]);
});

test('empty results stay empty, and database/auth errors never become a false empty inbox', async () => {
  const empty = await loadPortalPage(1, 10, async () => ({ data: [], count: 0, error: null }), () => { throw new Error('Unexpected query'); });
  assert.equal(empty.pageCount, 1);
  assert.deepEqual(empty.rows, []);
  await assert.rejects(() => loadPortalPage(1, 10, async () => ({ data: null, count: null, error: { message: 'Access denied' } }), async () => ({ count: 0, error: null })), /Access denied/);
  for (const value of ['-1', 'NaN', 'Infinity', '2.5', '99999999999999999999']) assert.equal(requestedPage(value), 1);
});

test('every built-in issue uses the exact public form wording in all three languages', () => {
  for (const language of ['de', 'it', 'en']) for (const [slug, label] of Object.entries(feedbackCategoryLabels[language])) {
    assert.equal(reportedIssueLabel({ category_slug: slug, feedback_categories: null }, language, 'Issue'), label);
    assert.equal(reportedIssueLabel({ category_slug: slug, feedback_categories: { label_de: 'old', label_it: 'old', label_en: 'old' } }, language, 'Issue'), label);
  }
});

test('custom categories accept both relationship shapes, without exposing internal codes', () => {
  const labels = { label_de: 'Neue Ausstattung', label_it: 'Nuova dotazione', label_en: 'New facilities' };
  for (const value of [labels, [labels]]) assert.equal(reportedIssueLabel({ category_slug: 'custom_internal_code', feedback_categories: value }, 'it', 'Problema segnalato'), 'Nuova dotazione');
  assert.equal(reportedIssueLabel({ category_slug: 'unknown_internal_code', feedback_categories: null }, 'en', 'Reported issue'), 'Reported issue');
});
