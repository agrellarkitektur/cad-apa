import type { IconName } from '../icons';

/**
 * Modifiera-valen (0.7): namnen, ikonerna, förklaringarna och värdena som
 * kan skrivas in. Vilka som erbjuds för ett klick står i ops.ts.
 * (Utbrutet ur ops.ts i granskningen efter 0.10.18.)
 */

export type OpId =
  | 'wallOn'
  | 'insert'
  | 'curve'
  | 'tangent'
  | 'straighten'
  | 'offset'
  | 'parallel'
  | 'offsetAll'
  | 'stretch'
  | 'extend'
  | 'fillet'
  | 'chamfer'
  | 'merge'
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'shapeInsert'
  | 'shapeMove'
  | 'shapeRemove'
  | 'shapeOffset'
  | 'shapeBend'
  | 'shapeStraighten'
  | 'shapeFillet'
  | 'shapeChamfer'
  | 'holeMove'
  | 'holeRotate'
  | 'holeMirror'
  | 'crestPoint'
  | 'pathLevel'
  | 'pathLevelClear'
  | 'pathExtend'
  | 'pathEase'
  | 'pathEaseSharp'
  | 'stairRailing'
  | 'stairRailings'
  | 'stairLanding'
  | 'stairSteps'
  | 'stairTurnLanding'
  | 'stairWinders'
  | 'pathEaseClear'
  | 'holeRemove'
  | 'roofTrim'
  | 'roofCutPerp'
  | 'roofCutPlumb'
  | 'roofCutAngle'
  | 'roofCutAuto'
  | 'trim'
  | 'join'
  | 'split'
  | 'filletAll'
  | 'chamferAll'
  | 'align'
  | 'pick'
  | 'scale'
  | 'extendAll'
  | 'trimAll'
  | 'moveZ'
  | 'shapeFuse';

export interface OpDef {
  label: string;
  /** Kort text under ikonen. Hela namnet och förklaringen visas vid hovring. */
  short: string;
  icon: IconName;
  /** Ett värde som kan skrivas in, med enhet och förval. */
  value?: { label: string; unit: 'mm' | 'm' | '°' | 'st' | '×'; initial: number };
  /** Utförs direkt när man väljer det, utan att klicka i ritningen. */
  instant?: boolean;
  /**
   * Värdet skrivs vid objektet (0.10.29), inte i ett fält i menyn: siffrorna
   * syns i måttet vid objektet, och Enter utför.
   */
  atObject?: boolean;
  hint: string;
}

export const OPS: Record<OpId, OpDef> = {
  wallOn: { label: 'Ny vägg härifrån', short: 'Ny vägg', icon: 'wall', hint: 'Klicka punkt för punkt, eller skriv en längd och tryck Enter. Samma typ och höjd som väggen. Esc avslutar.' },
  insert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga. Väggen delas i två.' },
  curve: { label: 'Böj', short: 'Böj', icon: 'curveEdge', value: { label: 'Radie', unit: 'mm', initial: 3000 }, hint: 'Klicka en punkt som bågen ska gå igenom, eller skriv radien.' },
  tangent: { label: 'Båge med tangent', short: 'Tangent', icon: 'tangentArc', hint: 'Bågen fortsätter i grannväggens riktning. Klicka var änden ska hamna.' },
  straighten: { label: 'Räta ut', short: 'Räta ut', icon: 'straighten', instant: true, hint: 'Bågen blir rak igen.' },
  offset: { label: 'Förskjut', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, atObject: true, hint: 'Klicka dit väggen ska, eller skriv avståndet och tryck Enter; anslutna väggar följer med.' },
  parallel: { label: 'Parallell kopia', short: 'Parallell', icon: 'parallelCopy', value: { label: 'Avstånd', unit: 'mm', initial: 1000 }, atObject: true, hint: 'Klicka var kopian ska ligga, eller skriv avståndet och tryck Enter (åt det håll du pekar).' },
  offsetAll: { label: 'Förskjut alla kanter', short: 'Alla kanter', icon: 'offsetAll', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, atObject: true, hint: 'Klicka, eller skriv avståndet och tryck Enter: ut, eller in med minus; hörnen räknas om.' },
  stretch: { label: 'Sträck', short: 'Sträck', icon: 'stretch', value: { label: 'Längd', unit: 'mm', initial: 0 }, hint: 'Klicka var änden ska hamna, eller skriv en ny längd.' },
  extend: { label: 'Förläng till', short: 'Förläng', icon: 'extend', hint: 'Klicka på väggen som änden ska gå fram till.' },
  fillet: { label: 'Avrunda hörn', short: 'Avrunda', icon: 'fillet', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Skriv radien och tryck Enter, eller klicka för att använda den.' },
  chamfer: { label: 'Fasa hörn', short: 'Fasa', icon: 'chamfer', value: { label: 'Avstånd', unit: 'mm', initial: 500 }, hint: 'Skriv avståndet från hörnet och tryck Enter, eller klicka.' },
  merge: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Två väggar som möts i hörnet blir en.' },
  move: { label: 'Flytta', short: 'Flytta', icon: 'move', hint: 'Klicka var det ska hamna. (Det går också att dra direkt.)' },
  rotate: { label: 'Vrid', short: 'Vrid', icon: 'rotate', value: { label: 'Vinkel', unit: '°', initial: 90 }, hint: 'Klicka en riktning att vrida från och sedan dit, eller skriv vinkeln.' },
  mirror: { label: 'Spegla', short: 'Spegla', icon: 'mirror', hint: 'Speglingslinjen går genom punkten du klickade; klicka linjens riktning.' },
  multiply: { label: 'Kopiera i rad', short: 'I rad', icon: 'multiply', value: { label: 'Antal', unit: 'st', initial: 3 }, hint: 'Klicka avståndet mellan kopiorna.' },
  shapeInsert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga.' },
  shapeMove: { label: 'Flytta punkt', short: 'Flytta', icon: 'move', hint: 'Klicka var punkten ska hamna. (Det går också att dra i den.)' },
  shapeRemove: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Punkten tas bort; grannarna binds ihop.' },
  roofCutPerp: { label: 'Vinkelrätt snitt', short: 'Vinkelrätt', icon: 'eavePerp', instant: true, hint: 'Kanten snittas vinkelrätt mot takytan.' },
  roofCutPlumb: { label: 'Lodrätt snitt', short: 'Lodrätt', icon: 'eavePlumb', instant: true, hint: 'Kanten snittas lodrätt.' },
  roofCutAngle: { label: 'Snitt med vinkel', short: 'Vinkel', icon: 'eaveAngle', value: { label: 'Vinkel', unit: '°', initial: 60 }, hint: 'Skriv snittets vinkel mot det vågräta och tryck Enter (90 = lodrätt), eller klicka för att använda den.' },
  roofCutAuto: { label: 'Snitt som förvalt', short: 'Förval', icon: 'roof', instant: true, hint: 'Kanten får takets förval igen: takfotens snitt, eller lodrätt för nock, grat och gavel.' },
  trim: { label: 'Trimma', short: 'Trimma', icon: 'trim', hint: 'Klicka på biten som ska bort. Den kapas där andra väggar eller linjer korsar.' },
  join: { label: 'Hörnskarv', short: 'Hörnskarv', icon: 'cornerJoin', hint: 'Klicka på den andra väggen eller linjen, på den del som ska vara kvar. Båda förlängs eller kortas till ett hörn.' },
  split: { label: 'Dela', short: 'Dela', icon: 'split', hint: 'Klicka där det ska delas. Det blir två, utan något hörn.' },
  filletAll: { label: 'Avrunda alla hörn', short: 'Avrunda alla', icon: 'filletAll', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Alla hörn mellan de markerade väggarna. Skriv radien och tryck Enter, eller klicka.' },
  chamferAll: { label: 'Fasa alla hörn', short: 'Fasa alla', icon: 'chamferAll', value: { label: 'Avstånd', unit: 'mm', initial: 500 }, hint: 'Alla hörn mellan de markerade väggarna. Skriv avståndet och tryck Enter, eller klicka.' },
  align: { label: 'Justera och fördela', short: 'Justera', icon: 'align', hint: 'Välj hur de ska ligga, eller klicka en linje, vägg eller kant att lägga dem mot.' },
  pick: { label: 'Hämta och överför', short: 'Pipett', icon: 'eyedropper', hint: 'Klicka på ett objekt av samma slag. Det markerade får dess typ och inställningar, men behåller sin form och sitt läge.' },
  scale: { label: 'Skala', short: 'Skala', icon: 'scale', value: { label: 'Faktor', unit: '×', initial: 2 }, hint: 'Klicka baspunkten, skriv faktorn eller klicka två punkter.' },
  extendAll: { label: 'Förläng alla till', short: 'Förläng alla', icon: 'extend', hint: 'Klicka på väggen eller linjen som de markerade ska förlängas fram till.' },
  trimAll: { label: 'Trimma mot gräns', short: 'Mot gräns', icon: 'trim', hint: 'Klicka på gränsen, sedan på den sida av den som ska bort.' },
  shapeBend: { label: 'Böj', short: 'Böj', icon: 'curveEdge', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Klicka en punkt som bågen ska gå igenom, eller skriv radien.' },
  shapeStraighten: { label: 'Räta ut', short: 'Räta ut', icon: 'straighten', instant: true, hint: 'Bågen blir rak igen.' },
  shapeOffset: { label: 'Förskjut kant', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, atObject: true, hint: 'Klicka dit kanten ska, eller skriv avståndet och tryck Enter; grannkanterna följer med. Med fler kanter flyttas grannarna på var sida (ett jämnt antal: en till mot markören), 0 = alla.' },
  shapeFillet: { label: 'Avrunda hörn', short: 'Avrunda', icon: 'fillet', value: { label: 'Radie', unit: 'mm', initial: 500 }, hint: 'Skriv radien och tryck Enter, eller klicka för att använda den. Bågen tangerar båda kanterna.' },
  shapeChamfer: { label: 'Fasa hörn', short: 'Fasa', icon: 'chamfer', value: { label: 'Avstånd', unit: 'mm', initial: 500 }, hint: 'Skriv avståndet från hörnet och tryck Enter, eller klicka för att använda det.' },
  holeMove: { label: 'Flytta hålet', short: 'Flytta hål', icon: 'move', hint: 'Klicka var hålet ska hamna, räknat från punkten du klickade på. Bjälklaget ligger kvar.' },
  holeRotate: { label: 'Vrid hålet', short: 'Vrid hål', icon: 'rotate', value: { label: 'Vinkel', unit: '°', initial: 90 }, hint: 'Hålet vrids kring punkten du klickade på: klicka en riktning att vrida från och sedan dit, eller skriv vinkeln. Bjälklaget ligger kvar.' },
  holeMirror: { label: 'Spegla hålet', short: 'Spegla hål', icon: 'mirror', hint: 'Speglingslinjen går genom punkten du klickade på; klicka linjens riktning. Bjälklaget ligger kvar.' },
  roofTrim: { label: 'Kapa mot tak', short: 'Kapa mot tak', icon: 'trim', hint: 'Klicka på takfallet som det ska kapas mot. Kvar blir den del du klickade på, eller den största.' },
  crestPoint: { label: 'Höjdpunkt på krönet', short: 'Höjdpunkt', icon: 'insertNode', value: { label: 'ÖK', unit: 'mm', initial: 0 }, hint: 'Skriv krönets höjd i punkten och tryck Enter (förslaget är höjden där nu), eller klicka för att använda den. Punkten dras sedan längs muren.' },
  pathLevel: { label: 'Höjd i punkten', short: 'Höjd', icon: 'moveZ', value: { label: 'Höjd', unit: 'mm', initial: 0 }, hint: 'Skriv höjden i punkten och tryck Enter (förslaget är höjden där nu), eller klicka för att använda den. Punkterna med höjd styr rampens lutning; mellan dem går den rakt.' },
  pathLevelClear: { label: 'Ta bort höjden', short: 'Utan höjd', icon: 'trash', instant: true, hint: 'Punkten följer lutningen mellan grannarna igen.' },
  pathExtend: { label: 'Förläng rampen', short: 'Förläng', icon: 'extend', hint: 'Klicka nya punkter från änden. Dubbelklick, Enter eller Klar avslutar; lutningen fortsätter.' },
  pathEase: { label: 'Mjuk övergång', short: 'Mjuk', icon: 'curveEdge', value: { label: 'Radie', unit: 'mm', initial: 20000 }, hint: 'Höjden går över i en vertikal kurva med radien i punkten, som på en gångväg. Skriv radien och tryck Enter, eller klicka för att använda den (förslaget är rampens).' },
  pathEaseSharp: { label: 'Skarp övergång', short: 'Skarp', icon: 'straighten', instant: true, hint: 'Höjden bryts skarpt i punkten, som ett vilplan i en betong- eller stenramp.' },
  stairRailing: { label: 'Räcke längs kanten', short: 'Räcke längs kanten', icon: 'railing', instant: true, hint: 'Ett räcke längs trappans kant närmast där du klickade; det följer trappan.' },
  stairRailings: { label: 'Räcken på båda sidor', short: 'Räcken på båda sidor', icon: 'railing', instant: true, hint: 'Räcken längs båda trappans kanter (de sidor som saknar).' },
  stairLanding: { label: 'Vilplan härifrån', short: 'Vilplan härifrån', icon: 'slab', instant: true, hint: 'Sträckan från punkten är ett vilplan, med svängarna i dess ändar.' },
  stairSteps: { label: 'Steg härifrån', short: 'Steg härifrån', icon: 'stair', instant: true, hint: 'Sträckan från punkten har steg igen.' },
  stairTurnLanding: { label: 'Vilplan i svängen', short: 'Vilplan i svängen', icon: 'slab', instant: true, hint: 'Svängen i punkten blir ett vilplan i stället för kilsteg.' },
  stairWinders: { label: 'Kilsteg i svängen', short: 'Kilsteg i svängen', icon: 'stair', instant: true, hint: 'Svängen i punkten får kilsteg igen.' },
  pathEaseClear: { label: 'Övergång som rampen', short: 'Som rampen', icon: 'trash', instant: true, hint: 'Punkten följer rampens inställning för övergångarna igen.' },
  moveZ: { label: 'Flytta i höjd', short: 'I höjd', icon: 'moveZ', value: { label: 'Höjd', unit: 'mm', initial: 100 }, hint: 'Skriv hur mycket upp (minus för ned) och tryck Enter. Hela objektet flyttas: väggens fot och topp, bjälklaget, möbeln eller taket.' },
  shapeFuse: { label: 'Foga ihop', short: 'Foga ihop', icon: 'fuse', instant: true, hint: 'De markerade linjerna som delar en ändpunkt blir en lång linje. Den första behåller sin penna.' },
  holeRemove: { label: 'Ta bort hålet', short: 'Ta bort hål', icon: 'trash', instant: true, hint: 'Håltagningen tas bort ur bjälklaget.' },
};
