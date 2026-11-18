import assert from 'node:assert/strict';
import { test } from 'node:test';
import { municipalityByOmc } from '../src/lib/municipality-reference.ts';
import { efaPlaceSourceId, planMunicipalityBackfill, readEfaMunicipalityMatches } from '../src/lib/municipality-backfill.ts';
const stop = (id,fields={}) => ({id,id_version:`(it:apb:StopPlace:it:22021:${id},any)`,name_it:`Stop ${id}`,municipality_de:'',municipality_it:'',...fields});
const location = (id,name,omc) => ({id:`it:22021:${id}`,parent:{name,type:'locality',properties:{omc}}});

test('official ANPR reference covers all 116 South Tyrol municipalities and full administrative names',()=>{
 assert.equal(municipalityByOmc.size,116);
 assert.equal(municipalityByOmc.get('22021051').de,'Meran');
 assert.equal(municipalityByOmc.get('22021027').it,'Curon Venosta');
 assert.equal(municipalityByOmc.get('22021052').de,'Welsberg-Taisten');
 assert.equal(municipalityByOmc.get('22021071').de,'Rasen-Antholz');
 assert.equal(municipalityByOmc.get('22021098').de,'Tramin an der Weinstraße');
});
test('Merano and frazioni use OMC to resolve the actual municipality, not the frazione name',()=>{
 const plan=planMunicipalityBackfill([stop('2553'),stop('6'),stop('3217')],{locations:[location('2553','Merano','22021051'),location('6','Resia (Curon Venosta)','22021027'),location('3217','Anterselva (Rasun Anterselva)','22021071')]});
 assert.deepEqual(plan.candidates.map(x=>x.omc),['22021051','22021027','22021071']);
 assert.equal(plan.issues.length,0);
});
test('full source IDs distinguish similar suffixes; missing identities, external provinces and conflicting feed codes remain unresolved',()=>{
 assert.equal(efaPlaceSourceId('(it:apb:StopPlace:it:22021:2553,v2)'),'it:22021:2553');
 assert.equal(efaPlaceSourceId('2553'),undefined);
 const plan=planMunicipalityBackfill([stop('2553'),stop('25531'),stop('outside'),stop('conflict'),stop('legacy',{id_version:null})],{locations:[location('2553','Merano','22021051'),location('outside','Passo Stelvio','22014009'),location('conflict','Merano','22021051'),location('conflict','Bolzano','22021008')]});
 assert.deepEqual(plan.candidates.map(x=>x.id),['2553']);
 assert.equal(plan.issues.length,4);
});
test('duplicate records are harmless only when their code agrees; malformed duplicates poison the match',()=>{
 const valid=location('1','Merano','22021051');
 assert.equal(readEfaMunicipalityMatches({locations:[valid,valid]}).matches.size,1);
 assert.equal(readEfaMunicipalityMatches({locations:[valid,{id:valid.id,parent:{name:'unknown'}}]}).matches.size,0);
});
test('existing translations are retained; incompatible partial translations require manual review',()=>{
 const plan=planMunicipalityBackfill([stop('1',{municipality_de:'Meran'}),stop('2',{municipality_de:'User translation'}),stop('3',{municipality_de:'Bozen',municipality_it:'Bolzano'})],{locations:[location('1','Merano','22021051'),location('2','Merano','22021051')]});
 assert.deepEqual(plan.candidates.map(x=>x.id),['1']);
 assert.equal(plan.issues[0].reason,'existing_translation_conflicts_with_reference');
 assert.throws(()=>planMunicipalityBackfill([],{locations:null}),/locations array/);
});
