#!/usr/bin/env python3
"""Normalize the official ANPR archive; no translations or geocoding guesses.
Download the documented source CSV separately, then pass its local path.
"""
import argparse,csv,datetime,hashlib,json,re
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('csv');parser.add_argument('--verified-at',default=datetime.date.today().isoformat());args=parser.parse_args()
source=Path(args.csv);rows=[]
def name(value,language):
    value=value.strip().title()
    words={'it':{'Sulla','Del','Di','Dei','Della','In','Nel','Allo'},'de':{'An','Der','In','Im','Am'}}[language]
    value=' '.join(word.lower() if word in words else word for word in value.split())
    if language=='it':
        value=value.replace("All'","all'").replace('sulla Strada del Vino','sulla strada del vino').replace('nel Parco Naturale','nel parco naturale')
    return value
for row in csv.DictReader(source.open(encoding='utf-8-sig')):
    if not row['CODISTAT'].startswith('021') or row['STATO']!='A' or row['DATACESSAZIONE']!='9999-12-31':continue
    if not row['ALTRADENOMINAZIONE'].strip():raise ValueError('Missing second-language name')
    rows.append({'omc':'22'+row['CODISTAT'],'de':name(row['ALTRADENOMINAZIONE'],'de'),'it':name(row['DENOMINAZIONE_IT'],'it'),'anprId':row['ID'],'sourceUpdatedAt':row['DATAULTIMOAGG']})
assert len(rows)==116 and len({row['omc'] for row in rows})==116,'Unexpected municipality coverage'
result={'verifiedAt':args.verified_at,'source':'https://github.com/italia/anpr/blob/master/src/archivi/ANPR_archivio_comuni.csv','rawSource':'https://raw.githubusercontent.com/italia/anpr/master/src/archivi/ANPR_archivio_comuni.csv','legend':'https://github.com/italia/anpr/blob/master/src/archivi/ANPR_archivio_comuni_legenda.md','attribution':'ANPR — Anagrafe Nazionale della Popolazione Residente; municipality archive, CC BY 4.0','license':'https://creativecommons.org/licenses/by/4.0/','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'municipalities':sorted(rows,key=lambda x:x['omc'])}
output=Path(__file__).resolve().parents[1]/'src/lib/municipality-reference.json';output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Wrote',len(rows),'official bilingual municipalities to',output)
