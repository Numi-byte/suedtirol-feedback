import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStopSearch,searchStopIndex,rankStopPoints,normalizeStopSearch} from '../src/lib/stop-search.ts';
const place=(id,name_de,name_it,municipality_it='',point_search=[])=>({id,name_de,name_it,name_en:'',municipality_it,point_search});
const places=[place('meran','Meran Bahnhof','Merano Stazione','Merano',[{name_de:'Steig Süd',name_it:'Banchina Sud',point_number:'2'}]),place('bozen','Bozen Bahnhof','Bolzano Stazione','Bolzano'),place('strasse','Weißes Kreuz','Croce Bianca','Bressanone'),place('pointonly','Zentrum','Centro','Bolzano',[{name_de:'Nord',name_it:'Bosco',point_number:'1'},{name_de:'Schule',name_it:'Scuola',point_number:'2'}])];
const run=q=>searchStopIndex(buildStopSearch(places,'de'),q).map(s=>s.id);
test('accent, punctuation, case, token order and compound spacing',()=>{
 assert.equal(normalizeStopSearch('  WEIßES, Kréuz! '),'weisses kreuz');
 for(const q of ['Meráno, Stazione','STAZIONE MERANO','MeranoStazione','meran bf'])assert.equal(run(q)[0],'meran');
 assert.deepEqual(run('weisses kreuz'),['strasse']);
 assert.deepEqual(run('croce Bressanone'),['strasse']);
});
test('point aliases find their place without combining unrelated sibling points',()=>{
 assert.deepEqual(run('banchina sud merano'),['meran']);
 assert.deepEqual(run('Bosco Bolzano'),['pointonly']);
 assert.deepEqual(run('bosco scuola'),[]);
});
test('conservative single-typo and transposition tolerance excludes short and numeric guesses',()=>{
 assert.equal(run('Bolzno')[0],'bozen');
 assert.equal(run('Bolazno')[0],'bozen');
 assert.deepEqual(run('xyz'),[]);
 assert.deepEqual(run('99999'),[]);
});
test('exact stop name wins over municipality-only and partial matches; no source mutation',()=>{
 const records=[place('municipality','Elsewhere','Altro','Merano'),place('partial','Merano centro','Merano Centro'),place('exact','Merano','Merano')];
 const snapshot=JSON.stringify(records);
 assert.equal(searchStopIndex(buildStopSearch(records,'it'),'Merano')[0].id,'exact');
 assert.equal(JSON.stringify(records),snapshot);
 assert.deepEqual(searchStopIndex(buildStopSearch(records,'de'),'   '),records);
});
test('all query words must match; pathological queries are bounded',()=>{
 assert.deepEqual(run('merano impossible'),[]);
 assert.deepEqual(run('x'.repeat(257)),[]);
});
test('point ranking preserves all content and prioritizes relevant translated names/numbers',()=>{
 const points=places[0].point_search.concat([{name_de:'Nord',name_it:'Nord',point_number:'1'}]);
 const ranked=rankStopPoints(points,'merano nord','it');
 assert.equal(ranked[0].point_number,'1');assert.equal(ranked.length,points.length);
 assert.equal(points[0].point_number,'2');
});
