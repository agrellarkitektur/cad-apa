"""Provfil för IFC-utredningen (cad-apa 0.12.6).

Skriver STEP-text för hand, som TypeScript-skrivaren ska göra: inga bibliotek,
löpande #-nummer, mm, IFC4 Reference View. Innehåll: ett rum med fyra väggar
(YV01, två skikt), ett bjälklag, ett fönster och en dörr i hål, ett rum
(IfcSpace) och egenskaper (standardens Pset_*Common med Status, BIP och
cad-apa:s egna).
"""
import sys, random

random.seed(7)  # deterministisk utskrift
CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'


def guid():
    n = random.getrandbits(128)
    s = ''
    for _ in range(22):
        s = CH[n & 63] + s
        n >>= 6
    return s


out = []


def e(txt):
    out.append(txt)
    return f'#{len(out)}'


def s(v):
    if v is None:
        return '$'
    v = v.replace("'", "''")
    enc = ''
    for c in v:
        enc += c if ord(c) < 128 else '\\X2\\%04X\\X0\\' % ord(c)
    return f"'{enc}'"


def f(x):
    r = repr(float(round(x, 4)))
    return r[:-1] if r.endswith('.0') else r  # 2700. i stället för 2700.0


def pts2(ps):
    return '(' + ','.join('(' + f(x) + ',' + f(y) + ')' for x, y in ps) + ')'


def tup(*xs):
    return '(' + ','.join(f(x) for x in xs) + ')'


# --- grund ---
person = e("IFCPERSON($,'Agrell','Carl August',$,$,$,$,$)")
org = e("IFCORGANIZATION($,'Agrell Arkitektur',$,$,$)")
po = e(f'IFCPERSONANDORGANIZATION({person},{org},$)')
app = e(f"IFCAPPLICATION({org},'0.12.6','cad-apa','cad-apa')")
oh = e(f'IFCOWNERHISTORY({po},{app},$,.NOCHANGE.,$,$,$,1763049600)')
origin = e('IFCCARTESIANPOINT((0.,0.,0.))')
zdir = e('IFCDIRECTION((0.,0.,1.))')
xdir = e('IFCDIRECTION((1.,0.,0.))')
wcs = e(f'IFCAXIS2PLACEMENT3D({origin},$,$)')
north = e('IFCDIRECTION((0.,1.))')
ctx = e(f"IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.01,{wcs},{north})")
body = e(f"IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,{ctx},$,.MODEL_VIEW.,$)")
axis = e(f"IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,{ctx},$,.GRAPH_VIEW.,$)")
u_len = e('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')
u_area = e('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')
u_vol = e('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')
u_ang = e('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')
units = e(f'IFCUNITASSIGNMENT(({u_len},{u_area},{u_vol},{u_ang}))')
project = e(f"IFCPROJECT('{guid()}',{oh},'Provhuset',$,$,$,$,({ctx}),{units})")


def place(rel, x=0, y=0, z=0, rot=None):
    p = e(f'IFCCARTESIANPOINT({tup(x, y, z)})')
    if rot:
        d = e(f'IFCDIRECTION({tup(rot[0], rot[1], 0)})')
        a = e(f'IFCAXIS2PLACEMENT3D({p},{zdir},{d})')
    else:
        a = e(f'IFCAXIS2PLACEMENT3D({p},$,$)')
    return e(f"IFCLOCALPLACEMENT({rel or '$'},{a})")


site_pl = place(None)
site = e(f"IFCSITE('{guid()}',{oh},'Platsen',$,$,{site_pl},$,$,.ELEMENT.,(59,20,0,0),(18,3,0,0),0.,$,$)")
bldg_pl = place(site_pl)
bldg = e(f"IFCBUILDING('{guid()}',{oh},'Huset',$,$,{bldg_pl},$,$,.ELEMENT.,$,$,$)")
st_pl = place(bldg_pl)
storey = e(f"IFCBUILDINGSTOREY('{guid()}',{oh},'Plan 1',$,$,{st_pl},$,$,.ELEMENT.,0.)")
e(f"IFCRELAGGREGATES('{guid()}',{oh},$,$,{project},({site}))")
e(f"IFCRELAGGREGATES('{guid()}',{oh},$,$,{site},({bldg}))")
e(f"IFCRELAGGREGATES('{guid()}',{oh},$,$,{bldg},({storey}))")

# --- stilar (materialens kulörer) ---
styles = {}


def style(name, r, g, b, transp=0.):
    if name in styles:
        return styles[name]
    col = e(f"IFCCOLOURRGB($,{f(r)},{f(g)},{f(b)})")
    ren = e(f'IFCSURFACESTYLERENDERING({col},{f(transp)},$,$,$,$,$,$,.NOTDEFINED.)')
    styles[name] = e(f"IFCSURFACESTYLE({s(name)},.BOTH.,({ren}))")
    return styles[name]


def styled(item, st):
    e(f'IFCSTYLEDITEM({item},({st}),$)')


def profile(ring, holes=()):
    """Ytterkontur (och hål) som IfcIndexedPolyCurve; Reference View vill ha den."""
    def curve(r):
        pl = e(f'IFCCARTESIANPOINTLIST2D({pts2(r)},$)')
        idx = ','.join(f'IFCLINEINDEX(({i + 1},{(i + 1) % len(r) + 1}))' for i in range(len(r)))
        return e(f'IFCINDEXEDPOLYCURVE({pl},({idx}),.F.)')
    outer = curve(ring)
    if holes:
        inner = ','.join(curve(h) for h in holes)
        return e(f'IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,{outer},({inner}))')
    return e(f'IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,{outer})')


def extrusion(ring, z0, depth, st=None, holes=()):
    pos = e(f'IFCAXIS2PLACEMENT3D({e(f"IFCCARTESIANPOINT({tup(0, 0, z0)})")},$,$)')
    solid = e(f'IFCEXTRUDEDAREASOLID({profile(ring, holes)},{pos},{zdir},{f(depth)})')
    if st:
        styled(solid, st)
    return solid


def shape(items, kind='SweptSolid', extra=()):
    rep = e(f"IFCSHAPEREPRESENTATION({body},'Body','{kind}',({','.join(items)}))")
    return e(f"IFCPRODUCTDEFINITIONSHAPE($,$,({','.join([rep, *extra])}))")


def tessellated(tris_pts, faces, st=None):
    """Krokigt (trappor, räcken, sneda tak): IfcTriangulatedFaceSet."""
    pl = e(f"IFCCARTESIANPOINTLIST3D(({','.join(tup(*p) for p in tris_pts)}),$)")
    idx = ','.join('(' + ','.join(str(i + 1) for i in t) + ')' for t in faces)
    fs = e(f'IFCTRIANGULATEDFACESET({pl},$,.T.,({idx}),$)')
    if st:
        styled(fs, st)
    return fs


def pset(name, owners, props):
    vals = []
    for k, v in props.items():
        if isinstance(v, bool):
            val = f"IFCBOOLEAN(.{'T' if v else 'F'}.)"
        elif k == 'ThermalTransmittance':
            val = f'IFCTHERMALTRANSMITTANCEMEASURE({f(v)})'
        elif isinstance(v, (int, float)) and k in ('Area', 'BTA', 'BYA', 'BOA'):
            val = f'IFCAREAMEASURE({f(v)})'
        elif isinstance(v, (int, float)) and k in ('Öppningsbredd', 'Bröstningshöjd'):
            val = f'IFCLENGTHMEASURE({f(v)})'
        elif isinstance(v, (int, float)):
            val = f'IFCREAL({f(v)})'
        elif k == 'Status':
            val = f'IFCLABEL({s(v)})'
        else:
            val = f'IFCLABEL({s(v)})'
        vals.append(e(f'IFCPROPERTYSINGLEVALUE({s(k)},$,{val},$)'))
    p = e(f"IFCPROPERTYSET('{guid()}',{oh},{s(name)},$,({','.join(vals)}))")
    e(f"IFCRELDEFINESBYPROPERTIES('{guid()}',{oh},$,$,({','.join(owners)}),{p})")
    return p


contained = []

# --- material och väggtyp ---
m_puts = e("IFCMATERIAL('Puts',$,'Puts')")
m_lv = e("IFCMATERIAL('L\\X2\\00E4\\X0\\ttbetong',$,'Betong')")
cset = e(f"IFCMATERIALCONSTITUENTSET('YV01',$,(" +
         e(f"IFCMATERIALCONSTITUENT('Puts 20',$,{m_puts},0.0625,'Utv\\X2\\00E4\\X0\\ndigt')") + ',' +
         e(f"IFCMATERIALCONSTITUENT('L\\X2\\00E4\\X0\\ttbetong 280',$,{m_lv},0.9375,'Stomme')") + '))')
wall_type = e(f"IFCWALLTYPE('{guid()}',{oh},'YV01',$,$,$,$,$,$,.STANDARD.)")
st_wall = style('Puts', 0.92, 0.9, 0.86)
st_glass = style('Glas', 0.6, 0.75, 0.85, 0.6)
st_frame = style('Karm', 0.97, 0.97, 0.97)
st_slab = style('Betong', 0.75, 0.75, 0.74)

# --- väggar: fyra, 300 tjocka, 2700 höga, rummet 6000 x 4000 utvändigt ---
T, H = 300, 2700
walls = []
segs = [((0, 0), (6000, 0)), ((6000, 0), (6000, 4000)), ((6000, 4000), (0, 4000)), ((0, 4000), (0, 0))]
for n, (a, b) in enumerate(segs):
    L = abs(b[0] - a[0]) + abs(b[1] - a[1])
    d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
    pl = place(st_pl, a[0], a[1], 0, d)
    # i väggens lokala system: x längs väggen, y inåt (vänster om riktningen)
    ring = [(0, 0), (L, 0), (L - T, T), (T, T)]
    solid = extrusion(ring, 0, H, st_wall)
    ax_pl = e(f'IFCCARTESIANPOINTLIST2D({pts2([(0, T / 2), (L, T / 2)])},$)')
    ax_c = e(f'IFCINDEXEDPOLYCURVE({ax_pl},$,.F.)')
    ax_rep = e(f"IFCSHAPEREPRESENTATION({axis},'Axis','Curve2D',({ax_c}))")
    w = e(f"IFCWALL('{guid()}',{oh},'YV01',$,$,{pl},{shape([solid], extra=[ax_rep])},'YV01',.STANDARD.)")
    walls.append((w, pl, L))
    contained.append(w)
e(f"IFCRELDEFINESBYTYPE('{guid()}',{oh},$,$,({','.join(w for w, _, _ in walls)}),{wall_type})")
e(f"IFCRELASSOCIATESMATERIAL('{guid()}',{oh},$,$,({wall_type}),{cset})")
pset('Pset_WallCommon', [w for w, _, _ in walls], {'Reference': 'YV01', 'Status': 'NEW', 'IsExternal': True, 'LoadBearing': True})
pset('BIP', [w for w, _, _ in walls], {'TypeID': 'YV01', 'RenovationStatus': 'New', 'StoreyName': 'Plan 1'})

# --- bjälklaget under ---
slab_pl = place(st_pl)
slab_solid = extrusion([(0, 0), (6000, 0), (6000, 4000), (0, 4000)], -250, 250, st_slab)
slab = e(f"IFCSLAB('{guid()}',{oh},'BJ01',$,$,{slab_pl},{shape([slab_solid])},'BJ01',.FLOOR.)")
contained.append(slab)
pset('Pset_SlabCommon', [slab], {'Reference': 'BJ01', 'Status': 'NEW', 'IsExternal': False, 'LoadBearing': True})


# --- öppningar: hål i väggen och det som fyller dem ---
def opening_in(wall, wall_pl, x, sill, w, h):
    o_pl = place(wall_pl, x, 0, sill)
    o_solid = extrusion([(0, -10), (w, -10), (w, T + 10), (0, T + 10)], 0, h)
    o = e(f"IFCOPENINGELEMENT('{guid()}',{oh},$,$,$,{o_pl},{shape([o_solid])},$,.OPENING.)")
    e(f"IFCRELVOIDSELEMENT('{guid()}',{oh},$,$,{wall},{o})")
    return o, o_pl


def frame_body(w, h, depth, y0):
    """Karmen som en ram (yttre kontur med ett hål) och glaset som en tunn skiva."""
    k = 60
    ring = [(0, y0), (w, y0), (w, y0 + depth), (0, y0 + depth)]
    # ramen ritas i väggens plan: x längs, z uppåt; extrudera i y genom att rotera profilen
    frame_pos = e(f'IFCAXIS2PLACEMENT3D({e(f"IFCCARTESIANPOINT({tup(0, y0, 0)})")},{e("IFCDIRECTION((0.,-1.,0.))")},{xdir})')
    prof = profile([(0, 0), (w, 0), (w, h), (0, h)], holes=[[(k, k), (w - k, k), (w - k, h - k), (k, h - k)]])
    frame = e(f'IFCEXTRUDEDAREASOLID({prof},{frame_pos},{zdir},{f(depth)})')
    styled(frame, st_frame)
    glass_pos = e(f'IFCAXIS2PLACEMENT3D({e(f"IFCCARTESIANPOINT({tup(0, y0 - depth / 2 + 12, 0)})")},{e("IFCDIRECTION((0.,-1.,0.))")},{xdir})')
    gprof = profile([(k, k), (w - k, k), (w - k, h - k), (k, h - k)])
    glass = e(f'IFCEXTRUDEDAREASOLID({gprof},{glass_pos},{zdir},24.)')
    styled(glass, st_glass)
    return [frame, glass]


win_type = e(f"IFCWINDOWTYPE('{guid()}',{oh},'Tr\\X2\\00E4\\X0\\f\\X2\\00F6\\X0\\nster 2-luft',$,$,$,$,$,$,.WINDOW.,.DOUBLE_PANEL_VERTICAL.,.F.,$)")
wall0, wall0_pl, _ = walls[0]
o1, o1_pl = opening_in(wall0, wall0_pl, 1000, 900, 1210, 1210)
win_pl = place(o1_pl, 5, 0, 5)
win = e(f"IFCWINDOW('{guid()}',{oh},'F01',$,$,{win_pl},{shape(frame_body(1200, 1200, 115, 115))},'F01',1200.,1200.,.WINDOW.,.DOUBLE_PANEL_VERTICAL.,$)")
e(f"IFCRELFILLSELEMENT('{guid()}',{oh},$,$,{o1},{win})")
e(f"IFCRELDEFINESBYTYPE('{guid()}',{oh},$,$,({win}),{win_type})")
pset('Pset_WindowCommon', [win], {'Reference': 'F01', 'Status': 'NEW', 'IsExternal': True, 'ThermalTransmittance': 1.0})
pset('BIP', [win], {'TypeID': 'F01', 'RenovationStatus': 'New', 'StoreyName': 'Plan 1', 'WindowOperation': 'Sidohängt'})
pset('CadApa_Fönsterförteckning', [win], {'Littera': 'F01', 'Hängning': 'V', 'Utförande': 'Träfönster 2-luft', 'Karmyttermått': '12 x 12', 'Öppningsbredd': 1210, 'Bröstningshöjd': 900, 'U-värde': '1,0'})
contained.append(win)

door_type = e(f"IFCDOORTYPE('{guid()}',{oh},'Ytterd\\X2\\00F6\\X0\\rr',$,$,$,$,$,$,.DOOR.,.SINGLE_SWING_LEFT.,.F.,$)")
o2, o2_pl = opening_in(wall0, wall0_pl, 3600, 0, 1010, 2110)
door_pl = place(o2_pl, 5, 0, 0)
door = e(f"IFCDOOR('{guid()}',{oh},'D01',$,$,{door_pl},{shape(frame_body(1000, 2100, 115, 115))},'D01',2100.,1000.,.DOOR.,.SINGLE_SWING_LEFT.,$)")
e(f"IFCRELFILLSELEMENT('{guid()}',{oh},$,$,{o2},{door})")
e(f"IFCRELDEFINESBYTYPE('{guid()}',{oh},$,$,({door}),{door_type})")
pset('Pset_DoorCommon', [door], {'Reference': 'D01', 'Status': 'NEW', 'IsExternal': True, 'HandicapAccessible': True})
pset('BIP', [door], {'TypeID': 'D01', 'RenovationStatus': 'New', 'StoreyName': 'Plan 1', 'DoorOperation': 'V'})
contained.append(door)

# --- rummet: IfcSpace som extrudering (det enda Reference View tillåter) ---
sp_pl = place(st_pl)
sp_solid = extrusion([(T, T), (6000 - T, T), (6000 - T, 4000 - T), (T, 4000 - T)], 0, 2500)
space = e(f"IFCSPACE('{guid()}',{oh},'101',$,$,{sp_pl},{shape([sp_solid])},'K\\X2\\00F6\\X0\\k',.ELEMENT.,.SPACE.,$)")
e(f"IFCRELAGGREGATES('{guid()}',{oh},$,$,{storey},({space}))")
area = (6000 - 2 * T) * (4000 - 2 * T) / 1e6
q_area = e(f"IFCQUANTITYAREA('NetFloorArea',$,$,{f(area)},$)")
q_h = e("IFCQUANTITYLENGTH('Height',$,$,2500.,$)")
qto = e(f"IFCELEMENTQUANTITY('{guid()}',{oh},'Qto_SpaceBaseQuantities',$,$,({q_area},{q_h}))")
e(f"IFCRELDEFINESBYPROPERTIES('{guid()}',{oh},$,$,({space}),{qto})")
pset('Pset_SpaceCommon', [space], {'Reference': '101', 'IsExternal': False})
pset('CadApa_Area', [space], {'Areaslag': 'BOA', 'Area': area})

# --- byggnadens areor för bygglovet ---
pset('CadApa_Areor', [bldg], {'BTA': 24.0, 'BYA': 24.0, 'BOA': area})

e(f"IFCRELCONTAINEDINSPATIALSTRUCTURE('{guid()}',{oh},$,$,({','.join(contained)}),{storey})")

head = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');
FILE_NAME('provhuset.ifc','2026-11-13T00:00:00',('Carl August Agrell'),('Agrell Arkitektur'),'cad-apa 0.12.6','cad-apa','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
"""
body_txt = ''.join(f'#{i + 1}={t};\n' for i, t in enumerate(out))
open(sys.argv[1], 'w', encoding='ascii').write(head + body_txt + 'ENDSEC;\nEND-ISO-10303-21;\n')
print(len(out), 'entiteter')
