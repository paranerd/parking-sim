# Entscheidungen aus dem externen Design-Dokument

Grundlage dieser Bewertung ist das
[Design-Dokument des Projekts `parking-simulator`](https://github.com/paranerd/parking-simulator/blob/main/DESIGN.md)
in der am 1. August 2026 abgerufenen Fassung.

## Direkt übernommen

### Mit genau einem Stellplatz beginnen

Der Start mit einem einzelnen, bereits belegten Stellplatz erzählt die
Fortschrittsfantasie besser als zehn vorhandene Plätze. Bei 2,50 € pro Stunde
entstehen 0,25 € pro Realsekunde. Der zweite Platz kostet 6 € und ist damit nach
ungefähr 24 Sekunden erreichbar. Die Kosten steigen anschließend um den Faktor
1,12. Das liegt im vorgeschlagenen Korridor von schnellen ersten Käufen und
spürbar längeren späteren Entscheidungen.

### Eine gemeinsame Berechnung für Simulation und Anzeige

`incomePerSecond()` ist die einzige Quelle für den Live-Gewinn und für den in
einem Tick gutgeschriebenen Betrag. Eine getrennte UI-Formel würde früher oder
später andere Werte anzeigen als tatsächlich ausgezahlt werden. Den Zeitraffer
von sechs Spielminuten pro Realsekunde übernehmen wir ebenfalls: Er ist schnell,
leicht erklärbar und führt zur gut lesbaren Formel `belegt × Preis × 0,1`.

### Preis als wirtschaftliche Entscheidung

Der Preis ist jetzt frei zwischen 0,50 € und 10,00 € in Schritten von 0,10 €
wählbar. Die vorhandene Nachfragefunktion reagiert bereits negativ auf höhere
Preise. Damit ersetzt der Regler das bisherige lineare Preis-Upgrade: Preis ist
eine Entscheidung und kein dauerhaft besser werdender Statuswert.

### Kapazität als harte Grenze und Nachfrage als Ergebnis

Die Simulation setzt die Auslastung nicht direkt. Fahrzeuge können nur bis zur
gebauten Kapazität ankommen, während Preis, Tageszeit und Ruf die
Ankunftswahrscheinlichkeit bestimmen. Dieses Prinzip behalten wir bei und werden
es beim nächsten Balancing-Schritt um sichtbare abgewiesene Nachfrage ergänzen.

### Reine, testbare Wirtschaftslogik

Berechnungen, Zustandsübergänge und Konstanten bleiben in `game.ts`, unabhängig
von DOM und Darstellung. Das macht Headless-Simulationen, reproduzierbare Zufälle
und Regressionstests möglich. Bei wachsendem Umfang sollte diese Datei in
`economy.ts`, `config.ts` und `types.ts` aufgeteilt werden.

### Faire Störungen und analytischer Offline-Fortschritt

Harte Offline-Ausfälle übernehmen wir ausdrücklich nicht. Der bestehende
Offline-Ertrag wird direkt aus einer gedeckelten Zeitspanne berechnet, statt
tausende Ticks nachzuspielen. Störungen reduzieren nur Teile des Betriebs und
können durch Wartung vermieden werden. Das folgt der Leitidee „Rückkehranreiz,
nicht Bestrafung“.

## Später übernehmen

### Logistische Zahlungsbereitschaft

Die vorgeschlagene S-Kurve ist besser als der aktuell lineare Preisfaktor: Ihr
Median ist verständlich, Extrempreise lassen sich sauber balancieren und es gibt
einen breiten Sweet Spot. Vor der Umstellung brauchen wir jedoch eine sichtbare
Anzeige für Nachfrage, Leerstand und abgewiesene Kunden. Ohne dieses Feedback
wäre der freie Preis zwar mathematisch wichtig, aber für Spieler schwer lesbar.

### Abgewiesene Kunden beeinflussen den Ruf

Das verhindert, dass dauerhafte Vollauslastung immer optimal ist, und erzeugt
einen Zielbereich unterhalb von 100 Prozent. Wir übernehmen es zusammen mit der
Nachfrageanzeige, damit sinkender Ruf nicht wie eine versteckte Strafe wirkt.

### Amortisationszeit statt frei erfundener Preise

Upgrade-Kosten aus gewünschter Amortisationszeit und Mehrertrag abzuleiten ist
der richtige langfristige Balancing-Ansatz. Die aktuelle geometrische Leiter
reicht für den kleinen MVP, soll aber durch ein Balance-Skript und Zielkorridore
ersetzt werden, bevor Parkdeck und Parkhaus hinzukommen.

### Ausbau-Stufen und Baufortschritt

Schotterplatz, Parkplatz, Parkdeck, Parkhaus und spätere Spezialbauten geben dem
Run klare Kapitel. Besonders große Sprünge sollten in sichtbare Teilprojekte
zerlegt werden. Wir übernehmen die Struktur, sobald die ersten 50 Stellplätze
ausbalanciert sind, statt jetzt sechs weitgehend leere Progressionsstufen
vorzutäuschen.

### Reichweite als zweite Ausbauachse

Schilder, Kartendienste und Kooperationen passen thematisch und lösen das
Problem, dass große Kapazitäten ausreichend Nachfrage benötigen. Das Dokument
benennt aber selbst, dass Reichweite derzeit die dominante statt eine
gleichwertige Achse ist. Deshalb kommt sie erst nach Preis- und
Kapazitätsbalancing hinzu und erhält Anschaffungs- sowie laufende Kosten.

### Automatisierung mit Zahlquote und Personalkosten

Die Abwägung „kostenlose Blechdose mit Zechprellern gegen bezahltes Personal und
Technik“ ist interessanter als ein reiner Einkommensmultiplikator. Dafür fehlen
im MVP noch Personal- und Fixkosten. Wir übernehmen das vollständige System
gemeinsam, statt vorab nur die Zahlquote einzubauen und den Start künstlich zu
verlangsamen.

### Prestige als Immobilienverkauf

„Beton wird zurückgesetzt, Wissen bleibt“ ist eine starke thematische Rahmung.
Prestige wird aber erst sinnvoll, wenn mindestens ein kompletter Ausbau-Run
existiert. Ein früher Maklerbrief kann das spätere Ziel ankündigen, ohne den MVP
bereits mit einem wirkungslosen Reset-Knopf zu belasten.

## Bewusst nicht übernommen

### React für den aktuellen MVP

Das Dokument nutzt React, unser Prototyp benötigt für eine einzelne Ansicht aber
keinen Komponenten-Runtime-Layer. Reines TypeScript hält Bundle und Architektur
klein. Wenn mehrere Standorte, Dialoge und komplexe Panels entstehen, sollte
diese Entscheidung neu bewertet werden.

### Vollständige Zahlen und sechs Stufen unverändert kopieren

Die Zielwerte sind eine ausgezeichnete Referenz, gehören aber zu einem anderen
Gesamtmodell mit Fixkosten, Städten, Reichweite, Personal und Prestige. Einzelne
Konstanten daraus in unser kleineres Modell zu kopieren würde nur den Anschein
von Balance erzeugen. Wir übernehmen zuerst die Herleitung und messen danach
unsere eigenen Werte.

### Genehmigungen als Echtzeit-Wartezeit im frühen Spiel

Ein fünfzehnminütiges Gate kann später einen sinnvollen Rückkehrpunkt bilden.
Vor dem ersten Parkdeck würde es den motivierenden Spielfluss jedoch abbrechen.
Zunächst sollen Investitionsentscheidungen, nicht Wartezeiten, die Sitzungen
strukturieren.

## Empfohlene nächste Umsetzungsschritte

1. Nachfrage, abgewiesene Kunden und den empfohlenen Preisbereich sichtbar
   machen.
2. Die lineare Preisreaktion durch eine logistische Zahlungsbereitschaft ersetzen.
3. Die ersten acht Stellplätze mit Zielzeiten von etwa 20 Sekunden bis drei
   Minuten ausbalancieren und per automatisierter Simulation prüfen.
4. Den Sprung vom Schotterplatz zum befestigten Parkplatz als erstes echtes
   Meilensteinprojekt ergänzen.
5. Erst danach Fixkosten, Personal/Zahlquote und Reichweite als zusammenhängendes
   Entscheidungssystem einführen.
