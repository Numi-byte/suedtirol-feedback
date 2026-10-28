import assert from 'node:assert/strict';
import { test } from 'node:test';
import { municipalityName } from './municipality.ts';
import { stopSearchFilter } from '../protected/src/lib/portal-pagination.ts';

test('municipality follows the UI language; English uses Italian', () => {
  const stop = { municipality: 'Old value', municipality_de: 'Bozen', municipality_it: 'Bolzano' };
  assert.equal(municipalityName(stop, 'de'), 'Bozen');
  assert.equal(municipalityName(stop, 'it'), 'Bolzano');
  assert.equal(municipalityName(stop, 'en'), 'Bolzano');
});

test('legacy and cached stops remain visible without fabricated translations', () => {
  for (const language of ['de', 'it', 'en']) {
    assert.equal(municipalityName({ municipality: 'Bressanone', municipality_de: '', municipality_it: '' }, language), 'Bressanone');
    assert.equal(municipalityName({ municipality: 'Bressanone' }, language), 'Bressanone');
    assert.equal(municipalityName(null, language), '');
  }
  assert.equal(municipalityName({ municipality_de: ' ', municipality_it: ' Merano ' }, 'de'), 'Merano');
});

test('staff search includes both municipality names and safely escapes filter characters', () => {
  const filter = stopSearchFilter('Bozen Bolzano');
  assert.match(filter, /municipality_de\.ilike/);
  assert.match(filter, /municipality_it\.ilike/);
  assert.match(filter, /municipality\.ilike/);
  assert.equal(stopSearchFilter(' '), null);
  assert.ok(stopSearchFilter('a%b_c').includes('a\\\\%b\\\\_c'));
});
