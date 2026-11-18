"""Generate a 16:9, non-technical architecture deck. Requires reportlab."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit
import math
OUT=Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont('Body','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
W,H=1600,900
BLUE='#055a81'; CYAN='#007eb5'; INK='#2a424d'; MUTED='#64818f'; SKY='#ecf6fa'; BG='#f5f8fa'; LINE='#dbe6ef'; GREEN='#2f8f5b'
c=canvas.Canvas(str(OUT/'system-architecture.pdf'),pagesize=(W,H))
c.setTitle('Südtirol Feedback | System architecture explained');c.setAuthor('Südtirol Feedback')
def rect(x,y,w,h,fill='#ffffff',stroke=LINE,r=24):
 c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.setLineWidth(1);c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=1)
def text(x,y,s,size=20,bold=False,color=INK):
 c.setFont('Bold' if bold else 'Body',size);c.setFillColor(HexColor(color));c.drawString(x,H-y-size,s)
def para(x,y,s,w,size=20,color=INK,bold=False,leading=None):
 lines=simpleSplit(s,'Bold' if bold else 'Body',size,w)
 for i,line in enumerate(lines):text(x,y+i*(leading or size*1.45),line,size,bold,color)
 return y+len(lines)*(leading or size*1.45)
def line(x,y,x2,y2,color=BLUE,width=2,dashed=False):
 c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.setDash(7,5) if dashed else c.setDash();c.line(x,H-y,x2,H-y2);c.setDash()
def arrow(x,y,x2,y2,color=CYAN,dashed=False):
 line(x,y,x2,y2,color,3,dashed);a=math.atan2(y2-y,x2-x)
 for d in [-.5,.5]:line(x2,y2,x2-12*math.cos(a+d),y2-12*math.sin(a+d),color,3)
def icon(kind,x,y,size=42,color=BLUE):
 # Deliberately simple line illustrations, rendered as vector paths.
 def L(a,b,d,e):line(x+a*size,y+b*size,x+d*size,y+e*size,color,2.5)
 c.setStrokeColor(HexColor(color));c.setFillColor(HexColor(color));c.setLineWidth(2.5)
 if kind=='pin':
  c.circle(x+size*.5,H-y-size*.35,size*.22,fill=0);L(.34,.53,.5,.88);L(.66,.53,.5,.88);c.circle(x+size*.5,H-y-size*.35,size*.065,fill=0)
 elif kind=='lock':
  c.roundRect(x+size*.2,H-y-size*.88,size*.6,size*.48,5,fill=0);c.arc(x+size*.3,H-y-size*.52,x+size*.7,H-y-size*.08,0,180);L(.5,.58,.5,.73)
 elif kind=='chat':
  c.roundRect(x+size*.08,H-y-size*.76,size*.84,size*.6,6,fill=0);L(.25,.76,.25,.94);L(.25,.94,.47,.76);L(.25,.35,.75,.35);L(.25,.53,.6,.53)
 elif kind=='data':
  for v in [.16,.44,.72]:
   c.roundRect(x+size*.1,H-y-size*(v+.2),size*.8,size*.2,4,fill=0)
 elif kind=='user':
  c.circle(x+size*.5,H-y-size*.25,size*.16,fill=0);c.arc(x+size*.14,H-y-size*.94,x+size*.86,H-y-size*.4,0,180);L(.14,.67,.14,.85);L(.86,.67,.86,.85)
 elif kind=='check':L(.18,.5,.42,.74);L(.42,.74,.88,.2)
 elif kind=='file':
  for a,b,d,e in [(.2,.08,.64,.08),(.64,.08,.84,.3),(.84,.3,.84,.92),(.84,.92,.2,.92),(.2,.92,.2,.08),(.33,.45,.7,.45),(.33,.64,.7,.64)]:L(a,b,d,e)
 elif kind=='gear':
  c.circle(x+size*.5,H-y-size*.5,size*.27,fill=0)
  for a in range(0,360,45):
   r=math.radians(a);L(.5+.28*math.cos(r),.5+.28*math.sin(r),.5+.43*math.cos(r),.5+.43*math.sin(r))
 else:
  c.roundRect(x,H-y-size*.78,size,size*.65,6,fill=0);L(0,.3,1,.3)
def start(n,title,subtitle):
 c.setFillColor(HexColor(BG));c.rect(0,0,W,H,fill=1,stroke=0)
 text(64,32,'SÜDTIROLMOBIL FEEDBACK',15,True,CYAN)
 text(64,68,title,43,True,BLUE);para(64,132,subtitle,1450,21,MUTED)
 line(64,842,1536,842,LINE,1)
 text(64,858,'PUBLIC TRANSPORT • SOUTH TYROL',12,True,MUTED)
 text(1360,858,f'SYSTEM OVERVIEW   {n} / 4',12,False,MUTED)
def badge(x,y,s,w):rect(x,y,w,34,SKY,SKY,17);text(x+14,y+7,s,13,True,BLUE)
def bullet(x,y,s,w):
 c.setFillColor(HexColor(CYAN));c.circle(x+4,H-y-12,3,fill=1,stroke=0)
 return para(x+20,y,s,w-20,19)+17
# 1: architecture overview
start(1,'One system. Two ways to use it.','Passengers share what needs improving. Staff manage the information and respond through a separate protected portal.')
for x,title,sub,kind in [(64,'Passenger website','PUBLIC MAP & FEEDBACK','pin'),(600,'Shared information','SUPABASE CLOUD SERVICES','data'),(1136,'Staff portal','PROTECTED WEBSITE','user')]:
 rect(x,218,400,390);icon(kind,x+26,244);text(x+85,246,title,24,True,BLUE);text(x+26,308,sub,13,True,MUTED)
y=350
for s in ['Browse published stops on a map','Choose an exact boarding point','Send feedback & optional photos','Read anonymous issues and replies']:y=bullet(90,y,s,345)
text(90,566,'Map background: OpenStreetMap',14,False,MUTED)
for yy,kind,title in [(348,'pin','Stops & boarding points'),(404,'chat','Feedback & team replies'),(460,'lock','Private photo storage'),(516,'user','Accounts & permissions')]:
 rect(626,yy,348,47,SKY,SKY,13);icon(kind,640,yy+9,28);text(684,yy+10,title,18,False,BLUE)
y=350
for s in ['Review feedback and reply','Maintain and publish stop data','Set categories, icons and photo rules','Owner manages user access']:y=bullet(1162,y,s,345)
# Conceptual information exchange arrows, independent of low-level HTTP routing.
arrow(474,410,590,410);arrow(590,410,474,410);text(482,352,'Share &',14,True,CYAN);text(482,373,'browse',14,True,CYAN)
arrow(1126,410,1010,410);arrow(1010,410,1126,410);text(1028,352,'Review &',14,True,CYAN);text(1028,373,'manage',14,True,CYAN)
badge(1158,561,'Allowed network + personal login',354)
rect(64,661,940,123,SKY,SKY);icon('check',88,690,42)
text(150,684,'Separate websites, shared information',24,True,BLUE)
para(150,725,'Both websites run on Vercel. Only selected information is public; staff access is controlled separately.',815,19)
rect(1136,681,400,103);icon('file',1158,701,35);text(1208,695,'Stop information comes from',16,True,BLUE)
para(1208,724,'EFA / STA + CSV files\nOfficial municipality reference',300,15,MUTED)
arrow(1336,671,1336,618,dashed=True);text(1360,631,'Staff imports',13,False,MUTED)
c.showPage()
# 2: feedback journey
start(2,'From observation to response','Feedback belongs to one selected boarding point, so the team knows exactly where the issue was reported.')
rect(64,201,1472,78,SKY,SKY);icon('pin',87,216,38)
text(145,216,'A stop place groups its boarding points',22,True,BLUE)
text(145,248,'Example: railway station → platform 1 / platform 2. The passenger selects the relevant point.',18,False,MUTED)
steps=[('pin','1  Choose a point','Open the map and select the exact platform or boarding point.'),('chat','2  Describe the issue','Select categories, add a short note and optionally attach a photo.'),('user','3  Team reviews','Authorized staff read the full report and can update its status.'),('check','4  Team responds','Staff with reply permission can publish a response for passengers.')]
for i,(kind,title,body) in enumerate(steps):
 x=64+i*384;rect(x,326,320,253);icon(kind,x+24,350,46);text(x+24,416,title,23,True,BLUE);para(x+24,461,body,272,19)
 if i<3:arrow(x+331,451,x+373,451)
rect(64,629,712,163);icon('chat',88,650,38);text(146,650,'Visible to passengers',24,True,BLUE)
para(88,703,'Published stop information, selected issue categories, dates and the team’s public replies.',650,21)
rect(800,629,736,163);icon('lock',824,650,38);text(882,650,'Kept in the staff area',24,True,BLUE)
para(824,703,'Free-text descriptions, uploaded photos and contact details. Contact details are collected only with consent.',674,21)
c.showPage()
# 3: security / administration
start(3,'Access is controlled in layers','The staff portal requires an allowed network, a personal login and the right permission for each task.')
for i,(kind,title,body) in enumerate([('lock','Allowed network','Vercel checks the visitor’s IP address before the protected portal loads.'),('user','Personal login','Supabase checks the account. Active users can change their own password.'),('check','Task permissions','The data service checks rights again before protected records are read or changed.')]):
 y=211+i*184;rect(64,y,665,151);icon(kind,88,y+28,48);text(159,y+23,title,26,True,BLUE);para(159,y+70,body,530,20)
 if i<2:arrow(396,y+157,396,y+178)
rect(787,211,749,519);text(817,240,'Permissions are building blocks',27,True,BLUE)
para(817,286,'The owner combines permissions for each account.',675,19,MUTED)
rows=[('chat','Read feedback','View the inbox and full reports.'),('chat','Reply to feedback','A separate right, requiring inbox access.'),('pin','Maintain stop information','Separate rights for imports and database editing.'),('gear','Manage the feedback form','Edit categories, SVG icons, order and photo limits.')]
for i,(kind,title,body) in enumerate(rows):
 y=336+i*87;icon(kind,817,y+7,34);text(875,y,title,21,True,BLUE);para(875,y+33,body,615,17,MUTED)
rect(64,762,1472,55,SKY,SKY,16)
text(88,777,'OWNER ONLY',15,True,CYAN);text(254,775,'Create accounts, grant permissions and deactivate access. Existing reports and replies are retained.',19)
c.showPage()
# 4: maintaining the stop catalogue and retaining history
start(4,'Current information. Lasting history.','Staff control what appears on the map, while past feedback remains available for review and evaluation.')
items=[('file','Bring in stop data','Import EFA / STA stop places and CSV files for places and boarding points.'),('gear','Review and enrich','Edit names, coordinates and transport type. Fill missing municipality names from official references.'),('pin','Publish for passengers','Only published, non-archived stop places and their points are available in the public map.')]
for i,(kind,title,body) in enumerate(items):
 x=64+i*512;rect(x,234,448,304);icon(kind,x+26,260,46);text(x+26,329,title,25,True,BLUE);para(x+26,384,body,396,21)
 if i<2:arrow(x+459,390,x+501,390)
rect(64,592,712,202);icon('chat',88,616,40);text(146,618,'Operational history',25,True,BLUE)
para(88,675,'Retiring a stop or deactivating a category retains earlier feedback. Existing reports and replies can still be reviewed.',650,21)
rect(800,592,736,202);icon('data',824,616,40);text(882,618,'Official testing dataset',25,True,BLUE)
para(824,675,'New reports are also captured as frozen snapshots for evaluation, while testing capture is enabled. Contact details, notes and photos are excluded.',674,21)
c.showPage();c.save()
print(OUT/'system-architecture.pdf')
