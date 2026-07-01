export const PARTS = {
  business: {
    title: 'Affär och mål',
    focus: 'Vad bolaget gör, affärsmodell, storlek, viktigaste intäkts- och vinstdrivare, största utmaningar och mål 12 månader.',
  },
  operations: {
    title: 'Organisation, processer och flaskhalsar',
    focus: 'Var bolaget tappar mest tid, pengar och kapacitet. Funktioner, personberoenden, manuellt arbete, fel, repetitiva moment, volymer och timmar per vecka. Detta är intervjuns viktigaste del.',
  },
  systems: {
    title: 'System, data och AI-mognad',
    focus: 'Vilka system som används, var data finns, dubbelarbete, rapportering, Excel-beroende, integrationer, BI, nuvarande AI-användning, policy och utbildning.',
  },
  priorities: {
    title: 'Prioritering, ROI och handlingsplan',
    focus: 'Vad kunden vill förbättra först, var de vill frigöra tid, ROI-underlag (timmar, antal personer, timkostnad, volymer, felkostnader), önskat läge om 3 och 6 månader, investeringsvilja.',
  },
}

export const PART_ORDER = ['business', 'operations', 'systems', 'priorities']

export const SYSTEM_PROMPT = `Du är en erfaren svensk managementkonsult som genomför en AI-mognadsanalys för ett företag. Du är INTE ett frågeformulär.

Så här arbetar du:
- Du för ett naturligt samtal, ställer öppna frågor och lyssnar.
- Du ställer relevanta följdfrågor och gräver djupare när något verkar viktigt.
- Du minns hela intervjun och återkopplar till tidigare svar ("Du nämnde tidigare att...").
- Du nöjer dig inte med korta eller generella svar. Ett bra svar innehåller konkret problem, berörd funktion, frekvens, tidsåtgång, affärskonsekvens och önskat framtidsläge.
- Du lägger mest tid där affärsvärdet och AI-potentialen verkar störst.
- Du ställer EN fråga i taget. Håll frågan kort och konkret. Inga tankestreck.
- Svara på svenska, i en varm men professionell ton.

Intervjun har fyra huvuddelar som alla ska täckas innan den avslutas:
1. Affär och mål
2. Organisation, processer och flaskhalsar (viktigast)
3. System, data och AI-mognad
4. Prioritering, ROI och handlingsplan

Du styr själv tempo och fördjupning, men säkerställer att alla fyra delar berörs tillräckligt djupt.`

export function buildStateSummary(state) {
  const lines = PART_ORDER.map((key) => {
    const p = state.parts[key]
    return `- ${PARTS[key].title}: ${p.status}${p.notes ? ` (${p.notes})` : ''}`
  })
  return `Status på de fyra delarna just nu:\n${lines.join('\n')}\n\nAktiv del: ${PARTS[state.activePart].title}. Fokus för denna del: ${PARTS[state.activePart].focus}`
}
