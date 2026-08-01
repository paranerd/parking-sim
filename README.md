# Parking Empire – Spielkonzept

Ein webbasiertes Idle- und Managementspiel, in dem aus einem unbefestigten
Parkplatz Schritt für Schritt ein automatisiertes Parkhaus-Imperium entsteht.

## Warum die Idee funktioniert

Das Thema passt sehr gut zu einem Idle-Spiel: Jeder Stellplatz ist zugleich ein
sichtbarer Ausbau und eine einfach verständliche Einnahmequelle. Die interessanteste
Entscheidung ist nicht, **ob** man ausbaut, sondern **wie**: mehr Kapazität, höhere
Preise, bessere Auslastung oder weniger laufende Kosten. So kann das Spiel leicht
zugänglich sein und trotzdem echte Managemententscheidungen bieten.

Damit es nicht zu einem reinen „Zahl wird größer“-Spiel wird, sollten drei
Zeithorizonte ineinandergreifen:

1. **Sekunden bis Minuten:** Fahrzeuge abfertigen, Preise anpassen und kleine
   Störungen beheben.
2. **Stunden bis Tage:** Einrichtungen verbessern, Personal automatisieren und
   neue Etagen bauen.
3. **Wochen:** neue Standorte freischalten, spezialisierte Parkhäuser entwickeln
   und über einen Neustart dauerhafte Vorteile erhalten.

## Kern-Spielschleife

1. Fahrzeuge kommen entsprechend Standort, Tageszeit, Preis und Ruf an.
2. Ein freier Stellplatz erzeugt beim Ausfahren Umsatz.
3. Der Spieler investiert den Gewinn in Kapazität, Attraktivität und Effizienz.
4. Mehr Betrieb erzeugt neue Engpässe: Einfahrt, Aufzüge, Reinigung, Sicherheit
   und Stromversorgung.
5. Automatisierung löst bekannte Engpässe, während neue Ausbaustufen neue
   Entscheidungen eröffnen.

Ein Fahrzeug sollte nicht nur „Geld pro Sekunde“ sein. Eine einfache Simulation
mit Ankunft, Parkplatzsuche, Parkdauer und Ausfahrt macht Verbesserungen unmittelbar
sichtbar und erzeugt kleine Geschichten auf dem Bildschirm.

## Ressourcen und Kennzahlen

| Kennzahl | Bedeutung | Beeinflussbar durch |
| --- | --- | --- |
| Bargeld | Bezahlt Bau, Reparaturen und Personal | Preise, Auslastung, Parkdauer |
| Auslastung | Anteil belegter Stellplätze | Nachfrage, Preis, Ruf, Events |
| Ruf | Beeinflusst Nachfrage und Kundentypen | Sauberkeit, Sicherheit, Bewertungen |
| Durchsatz | Fahrzeuge pro Minute | Schranken, Fahrspuren, Kennzeichenerkennung |
| Zustand | Zuverlässigkeit der Anlagen | Wartung, Qualität, Alter |
| Energie | Laufende Kosten und Ausbaugrenze | Solaranlage, Speicher, effiziente Technik |

Die Einnahmeformel kann zunächst bewusst lesbar bleiben:

```text
Einnahmen = belegte Plätze × Basistarif × Standortfaktor × Kundenzufriedenheit
Gewinn    = Einnahmen − Personal − Energie − Wartung − Standortkosten
```

Später kommen dynamische Parkdauer, unterschiedliche Tarife und Kundengruppen
hinzu. Im UI sollte immer erklärt werden, warum eine Kennzahl steigt oder fällt.

## Ausbaupfade

### Kapazität

- Schotterfläche → asphaltierter Parkplatz → Parkdeck → Parkhaus
- zusätzliche Stellplätze und Etagen
- breitere Fahrgassen für mehr Durchsatz, aber weniger Plätze
- kompakte Stellplätze für Kleinwagen
- reservierte Familien-, barrierefreie und Motorradplätze
- unterirdische Ebenen als teure Alternative bei einer Höhenbegrenzung

Eine neue Etage sollte nicht bloß `+50 Plätze` bedeuten. Ab einer bestimmten
Höhe werden Rampen, Aufzüge, Brandschutz oder Statik-Upgrades erforderlich. Das
erzeugt natürliche Meilensteine und verhindert monotones Stapeln.

### Service und Nachfrage

- Beleuchtung, Toiletten, Überdachung und Reinigung
- Ladestationen mit höherer Marge, aber Strombedarf und längerer Parkdauer
- Waschservice, Fahrradboxen, Paketstation und Snackautomat
- Wegweiser oder eine „Freie Plätze“-Anzeige für kürzere Suchzeiten
- Sicherheitskameras und Personal für einen besseren Ruf
- Kooperationen mit Einkaufszentren, Bahnhöfen, Stadien oder Flughäfen

### Automatisierung

| Manuelle Stufe | Automatisierte Stufe | Spielerischer Effekt |
| --- | --- | --- |
| Parkwächter | Schranke mit Ticket | geringere Personalkosten |
| Kassenhäuschen | Kassenautomat | Betrieb rund um die Uhr |
| Ticket und Schranke | Kennzeichenerkennung | höherer Durchsatz |
| Rundgang | Kamera und Sensorik | Probleme früher erkennen |
| feste Preise | dynamische Preisregeln | bessere Auslastung und Marge |
| Reparatur auf Klick | Wartungsvertrag | weniger aktive Eingriffe |

Automatisierung sollte Bequemlichkeit kaufen, nicht nur einen Multiplikator. Wer
aktiv spielt, kann kurzfristig effizienter sein; wer investiert, erzielt dafür
verlässliche Offline-Erträge.

## Entscheidungen statt linearer Upgrades

- **Preis gegen Auslastung:** Ein hoher Tarif steigert die Marge, kann aber freie
  Plätze und schlechte Bewertungen verursachen.
- **Kurzparker gegen Dauerparker:** Kurzparker bringen mehr Durchsatz, Dauerparker
  verlässliches Einkommen.
- **Qualität gegen Menge:** Premiumplätze brauchen mehr Fläche, ziehen aber
  zahlungskräftige Kundschaft an.
- **Personal gegen Technik:** Personal ist flexibel und sofort verfügbar; Technik
  kostet viel, arbeitet aber dauerhaft günstiger.
- **Wartung gegen Risiko:** Präventive Wartung kostet regelmäßig, während Betrieb
  bis zum Defekt kurzfristig profitabler, aber unberechenbar ist.
- **Autos gegen Mobilitätswende:** Mehr Stellplätze liefern heute Gewinn;
  Ladepunkte, Carsharing und Fahrradangebote sichern den Ruf von morgen.

## Störungen, ohne den Spieler zu bestrafen

Defekte sind ein guter Rückkehranreiz, dürfen Offline-Spieler aber nicht ruinieren.
Statt die Produktion komplett anzuhalten, sollte ein Problem meist einen klar
begrenzten Teil des Betriebs beeinträchtigen.

Beispiele:

- defekte Schranke erzeugt einen Stau und reduziert den Durchsatz
- kaputter Kassenautomat zwingt Kunden zu einer anderen Ausfahrt
- ausgefallener Aufzug senkt die Zufriedenheit auf oberen Etagen
- verschmutzte Toilette beschädigt langsam den Ruf
- Stromausfall deaktiviert Ladepunkte und Kennzeichenerkennung
- falsch geparktes Auto blockiert zwei Plätze
- Wasserschaden sperrt eine Etage bis zur Reparatur

Für jedes Ereignis gibt es drei Reaktionen:

1. **Sofort selbst lösen:** günstig, verlangt aktive Aufmerksamkeit.
2. **Dienstleister rufen:** teuer, aber nach kurzer Zeit automatisch erledigt.
3. **Vorbeugen:** Wartungsplan, Ersatzteilbestand oder Versicherung reduziert
   Wahrscheinlichkeit und Auswirkung.

Ankündigungen („Schranke zeigt Verschleiß: 82 %“) machen Ausfälle planbar. Beim
Zurückkehren sollte eine Chronik zusammenfassen, was passiert ist und wie viel
Umsatz verloren ging. Zufällige Totalausfälle während langer Abwesenheit wären
hingegen frustrierend.

## Ereignisse und lebendige Nachfrage

- Tageszeiten mit Pendler-, Einkaufs- und Nachtverkehr
- Wochenenden, Ferien und Wetter
- Konzerte oder Fußballspiele mit großer, kurzer Nachfragespitze
- Baustelle in der Nachbarschaft als Chance oder Zufahrtsproblem
- Großkunde möchte vorübergehend ein Kontingent reservieren
- Kontrolle von Brandschutz oder Barrierefreiheit
- Influencer-Bewertung nach einer besonders guten oder schlechten Erfahrung

Events sollten vorab sichtbar sein, damit der Spieler Kapazität, Personal und
Preise vorbereiten kann. Überraschungen eignen sich eher für kleine Boni als für
große Strafen.

## Standorte und langfristiger Fortschritt

Standorte können jeweils eigene Regeln mitbringen:

- **Vorstadt:** günstig, viel Fläche, schwankende Nachfrage
- **Innenstadt:** hohe Grundstückskosten, wenig Fläche, starke Nachfrage
- **Bahnhof:** Pendler und Monatsabos, deutliche Stoßzeiten
- **Stadion:** extreme Eventspitzen und lange Leerlaufphasen
- **Flughafen:** lange Parkdauer, Shuttlebus und Sicherheitsanforderungen

Nach einem erfolgreichen Verkauf oder einer Konzessionslaufzeit beginnt der
Spieler an einem neuen Standort. Dauerhaft bleiben beispielsweise Baupläne,
Forschungspunkte oder ein Firmenruf. Ein solcher „Prestige“-Neustart sollte neue
Mechaniken und nicht bloß einen globalen Prozentbonus freischalten.

## Missionen und Ziele

- Halte während eines Konzerts 95 % Auslastung ohne Einfahrtsstau.
- Erreiche einen Tag lang eine Bewertung von 4,5 Sternen.
- Betreibe einen Standort vollständig CO₂-neutral.
- Gewinne 100 Stammkunden für ein Monatsabo.
- Bewältige eine Woche ohne manuelle Reparatur.
- Baue eine weitere Etage, ohne dafür einen Kredit aufzunehmen.

Optionale Herausforderungen erlauben unterschiedliche Spielstile. Achievements
können kosmetische Fassaden, Schilder, Fahrzeug-Skins oder neue Landschaften
freischalten, ohne die Balance zu verzerren.

## Fairer Offline-Fortschritt

- Der Server oder ein vertrauenswürdiger Zeitstempel speichert den letzten Besuch.
- Offline-Einnahmen werden mit demselben Simulationsmodell vereinfacht berechnet.
- Ein Lager- oder Managementlimit deckelt zunächst beispielsweise acht Stunden;
  Upgrades erweitern dieses Fenster.
- Störungen reduzieren offline nur die Leistung; sie vernichten kein Gebäude und
  erzeugen keine unbezahlbaren Schulden.
- Der Rückkehrdialog zeigt Einnahmen, Kosten, Ereignisse und entgangenes Potenzial.

## Sinnvoller MVP

Für eine erste spielbare Version reicht ein enger Umfang:

1. ein Standort mit 10 Stellplätzen und sichtbaren Fahrzeugen
2. Ankunft, Parkdauer, Bezahlung und Ausfahrt
3. drei Upgradekategorien: Plätze, Preis und Einfahrtsgeschwindigkeit
4. zwei Komfortverbesserungen: Beleuchtung und Toilette
5. ein manueller Parkwächter und eine automatische Schranke
6. drei begrenzte Störungen mit Reparaturentscheidung
7. Savegame plus nachvollziehbare Offline-Einnahmen
8. ein klares Ziel: das erste Parkdeck mit 50 Plätzen errichten

Erst wenn dieser Loop Spaß macht, sollten mehrere Etagen, Forschung, Personal,
Standorte und Prestige dazukommen. Ein sichtbarer Fahrzeugfluss und verständliches
Feedback sind für den MVP wichtiger als eine große Upgrade-Liste.

## Technische Umsetzungsidee

Für den Prototyp genügt eine clientseitige Webanwendung:

- diskrete Simulation in festen Ticks (zum Beispiel einmal pro Sekunde)
- getrennte Module für Simulationszustand, Regeln und Darstellung
- Datenobjekte für Upgrades und Ereignisse statt fest verdrahteter UI-Logik
- versioniertes Savegame in `localStorage`; später optional Cloud-Sync
- Offline-Simulation anhand des gespeicherten Zeitpunkts und eines gedeckelten
  Zeitraums
- deterministischer Zufallszahlengenerator für reproduzierbare Tests

Wichtige Regeln sollten als reine Funktionen implementiert werden. Damit lassen
sich Einnahmen, Auslastung, Upgrade-Kosten und Offline-Fortschritt ohne Browser
testen. Für die Anzeige reichen zu Beginn CSS, einfache Formen und kleine
Animationen; aufwendige 3D-Grafik ist für die Validierung der Spielidee unnötig.

## Früh zu testende Fragen

1. Macht es Spaß, den Fahrzeugfluss zu beobachten, auch ohne ständig zu klicken?
2. Versteht der Spieler, welcher Engpass seinen Gewinn begrenzt?
3. Sind Preis, Kapazität und Service echte Alternativen oder gibt es immer nur
   eine offensichtlich beste Investition?
4. Wie oft darf eine Störung auftreten, bevor sie wie Arbeit wirkt?
5. Fühlt sich die erste Automatisierung wie ein bedeutender Fortschritt an?
6. Ist der Weg zum ersten Parkdeck innerhalb einer kurzen Spielsitzung sichtbar?

Ein kleiner vertikaler Prototyp mit fünf bis zehn Testspielern kann diese Fragen
besser beantworten als ein bereits vollständig ausgebautes Metagame.
