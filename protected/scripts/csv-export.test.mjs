import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,csvLine,flattenExport} from '../src/lib/csv-export.ts';
test('CSV preserves Unicode, quotes, separators, newlines, nulls and numeric values',()=>{
 assert.equal(csvLine(['Meran, Süd','a"b','line\nnext',null,-46.5]),'"Meran, Süd","a""b","line\nnext","","-46.5"\r\n');
});
test('spreadsheet formula prefixes including whitespace are neutralized',()=>{
 for(const value of ['=HYPERLINK("evil")',' +1','-2+3','@SUM(A1)','\t=1','\n=1'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('ordinary-name'),'"ordinary-name"');
});
test('feedback export flattens both relationship shapes and retains reply/report context',()=>{
 const row=flattenExport({id:'r',description:'private',email:'staff-visible@example.test',bus_stops:[{name_it:'Stazione'}],stop_points:{name_it:'Nord',point_number:'2'},feedback_replies:[{id:'reply',body:'Response',author_id:'staff'}],stop_feedback_categories:[{category_slug:'seating',feedback_categories:[{label_it:'Posti a sedere'}]}],stop_feedback_photos:[{id:'photo'}]},'feedback');
 assert.equal(row.place_name_it,'Stazione');assert.equal(row.point_number,'2');assert.equal(row.reply_body,'Response');assert.equal(row.categories_it,'Posti a sedere');assert.equal(row.photo_count,1);assert.equal(row.email,'staff-visible@example.test');assert.equal(row.feedback_replies,undefined);
});
test('point exports include parent context and stop-place exports preserve every source field',()=>{
 const raw={id:'p',latitude:46,bus_stops:{name_it:'Merano'}};
 assert.equal(flattenExport(raw,'points').place_name_it,'Merano');
 assert.deepEqual(flattenExport(raw,'places'),raw);
});
