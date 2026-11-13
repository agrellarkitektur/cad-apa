"""Strikt kontroll av en IFC4-fil, som förlaga till appens test i 0.12.6.

1. Antalet fält per entitet mot IFC4 ADD2 TC1 (IfcOpenShell släpper igenom
   för många fält; buildingSMARTs tjänst gör det inte).
2. Uppräknade värden (.X.) mot schemats listor, och utfasade värden (IFC102).
3. Förekomster med typ: PredefinedType, OperationType, PartitioningType tomma
   (OJT001, BLT001, BLT002).
4. Pset_*: egenskapernas namn, slag och datatyp mot buildingSMARTs tabell
   (PSE001), Qto_* med MethodOfMeasurement 'BaseQuantities' (QTY001).
5. Huvudets originating_system som 'Företag - Program - Version'.
"""
import ast, csv, re, sys
import ifcopenshell
import ifcopenshell.ifcopenshell_wrapper as w
import ifcopenshell.util.element as ue

path, csvpath = sys.argv[1], sys.argv[2]
S = w.schema_by_name('IFC4')
txt = open(path, encoding='ascii').read()
fel = []

DEPRECATED = {('IfcWall', 'STANDARD'), ('IfcWall', 'POLYGONAL'), ('IfcWall', 'ELEMENTEDWALL'),
              ('IfcWallType', 'STANDARD'), ('IfcWallType', 'POLYGONAL'), ('IfcWallType', 'ELEMENTEDWALL')}


def top_args(body):
    """Dela en STEP-parameterlista på kommatecken på översta nivån."""
    out, depth, cur, q = [], 0, '', False
    for c in body:
        if q:
            cur += c
            if c == "'":
                q = False
            continue
        if c == "'":
            q = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        if c == ',' and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += c
    out.append(cur)
    return out


for m in re.finditer(r"^#(\d+)=([A-Z0-9]+)\((.*)\);$", txt, re.M):
    nid, name, body = m.group(1), m.group(2), m.group(3)
    try:
        decl = S.declaration_by_name(name)
    except Exception:
        fel.append(f'#{nid} {name}: finns inte i IFC4')
        continue
    attrs = decl.all_attributes()
    args = top_args(body)
    if len(args) != len(attrs):
        fel.append(f'#{nid} {decl.name()}: {len(args)} fält, schemat har {len(attrs)}')
        continue
    for a, v in zip(attrs, args):
        v = v.strip()
        if v.startswith('.') and v.endswith('.') and v not in ('.T.', '.F.', '.U.'):
            t = a.type_of_attribute()
            while hasattr(t, 'declared_type'):
                t = t.declared_type()
            items = t.enumeration_items() if hasattr(t, 'enumeration_items') else ()
            if v[1:-1] not in items:
                fel.append(f'#{nid} {decl.name()}.{a.name()}: {v} finns inte')
            if (decl.name(), v[1:-1]) in DEPRECATED:
                fel.append(f'#{nid} {decl.name()}.{a.name()}: {v} är utfasat (IFC102)')

f = ifcopenshell.open(path)
for o in f.by_type('IfcObject'):
    t = ue.get_type(o)
    if not t:
        continue
    for attr in ('PredefinedType', 'OperationType', 'PartitioningType'):
        if hasattr(o, attr) and getattr(o, attr) is not None:
            fel.append(f'#{o.id()} {o.is_a()}.{attr}: ska vara tomt när typen finns')

defs = {}
for r in csv.DictReader(open(csvpath, encoding='utf-8')):
    defs[r['Name']] = {p['property_name']: p for p in ast.literal_eval(r['property_definitions'])}
for ps in f.by_type('IfcPropertySet'):
    if not ps.Name.startswith('Pset_'):
        continue
    d = defs.get(ps.Name)
    if d is None:
        fel.append(f'#{ps.id()} {ps.Name}: inte en standardens uppsättning')
        continue
    for p in ps.HasProperties:
        pd = d.get(p.Name)
        if pd is None:
            fel.append(f'#{ps.id()} {ps.Name}.{p.Name}: okänd egenskap')
            continue
        if p.is_a() != pd['property_type']:
            fel.append(f"#{ps.id()} {ps.Name}.{p.Name}: {p.is_a()}, ska vara {pd['property_type']}")
            continue
        dt = pd['data_type']
        if p.is_a('IfcPropertySingleValue') and p.NominalValue and dt.get('instance') and not p.NominalValue.is_a(dt['instance'].strip()):
            fel.append(f"#{ps.id()} {ps.Name}.{p.Name}: {p.NominalValue.is_a()}, ska vara {dt['instance']}")
        if p.is_a('IfcPropertyEnumeratedValue'):
            for v in p.EnumerationValues or ():
                if v.wrappedValue not in dt.get('values', []):
                    fel.append(f'#{ps.id()} {ps.Name}.{p.Name}: {v.wrappedValue} inte tillåtet')
for q in f.by_type('IfcElementQuantity'):
    if q.Name.startswith('Qto_') and q.MethodOfMeasurement != 'BaseQuantities':
        fel.append(f"#{q.id()} {q.Name}: MethodOfMeasurement ska vara 'BaseQuantities'")

orig = f.header.file_name.originating_system
if not re.match(r'(.+) - (.+) - (.+)', orig or ''):
    fel.append(f"huvudet: originating_system '{orig}' ska vara 'Företag - Program - Version'")

print('\n'.join(fel) if fel else 'inga fel')
print(len(fel), 'fel')
