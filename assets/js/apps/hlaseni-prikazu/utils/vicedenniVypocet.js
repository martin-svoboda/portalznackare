/**
 * Čisté funkce pro vícedenní výpočet stravného/náhrad.
 * Žádný import s vedlejšími efekty (žádný debug/DOM) — plně testovatelné.
 */

/** Převod "HH:mm" na hodiny jako číslo (např. "15:30" → 15.5). */
export function hodinyZCasu(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h)) return 0;
    return h + (isNaN(m) ? 0 : m) / 60;
}

/** Čitelný formát doby z desetinných hodin: 13.08 → "13 h 5 min", 24 → "24 h". */
export function formatHodinyMinuty(hodiny) {
    const total = Math.max(0, Math.round((Number(hodiny) || 0) * 60)); // celkové minuty
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Normalizace data na ISO "YYYY-MM-DD" bez UTC posunu (lokální kalendářní den). */
export function naIsoDatum(datum) {
    if (!datum) return '';
    if (typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}/.test(datum)) {
        return datum.slice(0, 10);
    }
    const d = datum instanceof Date ? datum : new Date(datum);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const den = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${den}`;
}

/** Přičte n dní k ISO datu, vrací ISO. */
export function isoPlusDny(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return naIsoDatum(dt);
}

/** Pole ISO dat od..do včetně (guard proti nekonečné smyčce). */
export function isoRozsah(odIso, doIso) {
    const out = [];
    let cur = odIso;
    let guard = 0;
    while (cur <= doIso && guard < 400) {
        out.push(cur);
        cur = isoPlusDny(cur, 1);
        guard++;
    }
    return out;
}

/** Množina ISO dat, kdy je zadaný nocleh (i nulový — rozhoduje jen existence + Datum). */
export function mnozinaNoclehu(noclezne) {
    const set = new Set();
    (noclezne || []).forEach(n => {
        const iso = naIsoDatum(n?.Datum);
        if (iso) set.add(iso);
    });
    return set;
}

/** Je aspoň jeden nocleh v rozsahu [odIso..doIso]? */
export function jeNoclehVRozsahu(noclehSet, odIso, doIso) {
    if (!odIso || !doIso || doIso < odIso) return false;
    for (const iso of isoRozsah(odIso, doIso)) {
        if (noclehSet.has(iso)) return true;
    }
    return false;
}

/**
 * Z pracovních dnů (z calculateWorkDays, obohacených o Uzavreny/Od/Do) a noclehů
 * sestaví účetní dny s hodinami pro tiér stravného/náhrad — VŽDY po dnech.
 *
 * Pravidlo denního okna:
 *  - uzavřený den (okruh tam+zpět) → skutečné okno (den.Cas)   ← scénář I + override
 *  - jinak: start = půlnoc, je-li předchozí noc krytá noclehem, jinak odjezd;
 *           end   = půlnoc, je-li tato noc krytá noclehem, jinak příjezd
 *  - prázdný den uvnitř pobytu (bez úseků) → 24 h
 */
export function budujUcetniDny(workDays, noclezne) {
    if (!Array.isArray(workDays) || workDays.length === 0) return [];

    const dny = workDays
        .filter(d => d && d.Datum)
        .slice()
        .sort((a, b) => (a.Datum < b.Datum ? -1 : a.Datum > b.Datum ? 1 : 0));
    if (dny.length === 0) return [];

    const noclehSet = mnozinaNoclehu(noclezne);

    // Rozdělení na bloky: souvislý pobyt (nocleh v mezeře) vs. hranice (samostatné dny)
    const bloky = [];
    let blok = [dny[0]];
    for (let i = 1; i < dny.length; i++) {
        const prev = dny[i - 1];
        const cur = dny[i];
        // Nocleh v rozsahu [prev.Datum … cur.Datum] VČETNĚ dne návratu — uživatel datuje
        // nocleh buď na večer výjezdu, nebo na den pobytu/návratu; obojí musí propojit dny.
        const most = jeNoclehVRozsahu(noclehSet, prev.Datum, cur.Datum);
        if (most) {
            blok.push(cur);
        } else {
            bloky.push(blok);
            blok = [cur];
        }
    }
    bloky.push(blok);

    // Expanze bloků na účetní dny (včetně prázdných mezidní)
    const vysledek = [];
    bloky.forEach(b => {
        const first = b[0].Datum;
        const last = b[b.length - 1].Datum;
        const mapaDnu = new Map(b.map(d => [d.Datum, d]));
        isoRozsah(first, last).forEach(iso => {
            const denObj = mapaDnu.get(iso);
            const prevKryta = iso !== first;
            const tatoKryta = iso !== last;
            const okno = ucetniOkno(denObj, prevKryta, tatoKryta);
            if (okno.Cas > 0) {
                vysledek.push({
                    Datum: iso,
                    Od: okno.Od,
                    Do: okno.Do,
                    Cas: Math.round(okno.Cas * 100) / 100,
                    Typ: typDne(denObj, prevKryta, tatoKryta),
                });
            }
        });
    });
    return vysledek;
}

// Účetní okno dne (Od/Do/Cas) pro tiér stravného/náhrad:
//  - prázdný den pobytu → 00:00–24:00 (24 h)
//  - uzavřený okruh → skutečné okno dne (Od/Do/Cas)
//  - jinak: začátek = 00:00 při kryté předchozí noci, jinak odjezd;
//           konec = 24:00 při kryté této noci, jinak příjezd
function ucetniOkno(denObj, prevKryta, tatoKryta) {
    if (!denObj) return { Od: '00:00', Do: '24:00', Cas: 24 };
    if (denObj.Uzavreny) return { Od: denObj.Od, Do: denObj.Do, Cas: denObj.Cas };
    const Od = prevKryta ? '00:00' : denObj.Od;
    const Do = tatoKryta ? '24:00' : denObj.Do;
    return { Od, Do, Cas: Math.max(0, hodinyZCasu(Do) - hodinyZCasu(Od)) };
}

function typDne(denObj, prevKryta, tatoKryta) {
    if (!denObj) return 'pobyt';
    if (denObj.Uzavreny) return 'uzavreny';
    if (prevKryta && tatoKryta) return 'pobyt';
    if (tatoKryta) return 'prvni';
    if (prevKryta) return 'posledni';
    return 'otevreny';
}

/** Denní přehled napříč VŠEMI skupinami (pro validaci) — {Datum, Misto_Od, Misto_Do, Uzavreny}. */
export function denniPrehled(skupinyCest) {
    const segs = (skupinyCest || []).flatMap(g => g?.Cesty || []);
    const mapa = new Map();
    segs.forEach(s => {
        if (!s || !s.Cas_Odjezdu || !s.Cas_Prijezdu) return;
        const iso = naIsoDatum(s.Datum);
        if (!iso) return;
        if (!mapa.has(iso)) mapa.set(iso, []);
        mapa.get(iso).push(s);
    });
    const norm = x => (x || '').trim().toLowerCase();
    return [...mapa.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([iso, list]) => {
            let earliest = null, latest = null, segOd = null, segDo = null;
            list.forEach(s => {
                if (!earliest || s.Cas_Odjezdu < earliest) { earliest = s.Cas_Odjezdu; segOd = s; }
                if (!latest || s.Cas_Prijezdu > latest) { latest = s.Cas_Prijezdu; segDo = s; }
            });
            const mOd = (segOd?.Misto_Odjezdu || '').trim();
            const mDo = (segDo?.Misto_Prijezdu || '').trim();
            return { Datum: iso, Misto_Od: mOd, Misto_Do: mDo, Uzavreny: !!mOd && !!mDo && norm(mOd) === norm(mDo) };
        });
}

/** Počet unikátních cestovních dnů (napříč skupinami). */
export function pocetCestovnichDnu(skupinyCest) {
    return denniPrehled(skupinyCest).length;
}

/**
 * Soft varování pro vícedenní hlášení. Vrací pole { typ, text }.
 * Nikdy neblokuje — pouze informuje.
 */
export function detekujVicedenniProblemy(skupinyCest, noclezne) {
    const dny = denniPrehled(skupinyCest);
    const noclehSet = mnozinaNoclehu(noclezne);
    const warnings = [];
    if (dny.length === 0) return warnings;

    if (dny.length < 2) {
        if (noclehSet.size > 0) {
            warnings.push({ typ: 'nocleh_jednodenni', text: 'Máš vyplněný nocleh, ale všechny cesty jsou ve stejný den.' });
        }
        return warnings;
    }

    const prvni = dny[0].Datum;
    const posledni = dny[dny.length - 1].Datum;

    noclehSet.forEach(iso => {
        if (iso < prvni || iso > posledni) {
            warnings.push({ typ: 'nocleh_mimo', text: `Nocleh ${iso} je mimo rozsah cest (${prvni} – ${posledni}).` });
        }
    });

    if (noclehSet.size === 0) {
        const otevreny = dny.find(d => !d.Uzavreny);
        if (otevreny) {
            warnings.push({
                typ: 'mozny_pobyt',
                text: `Cesty jsou ve více dnech a den ${otevreny.Datum} nekončí návratem do výchozího místa. Pokud šlo o vícedenní akci s přespáním, doplň nocleh (i nulový) – jinak se dny počítají jako samostatné.`,
            });
        }
    }

    return warnings;
}
