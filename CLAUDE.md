# Parking Empire

Idle-Simulation eines Parkplatzes: Vite + TypeScript + SCSS, kein Framework.
`src/game.ts` enthält die gesamte Spiellogik als reine Funktionen, `src/main.ts`
rendert und treibt die Schleife, `src/storage.ts` lädt und migriert Spielstände.

## Arbeitsweise

- **Immer Screenshots der relevanten Änderungen erstellen** und in den Pull
  Request einbetten, damit sie ohne lokalen Start beurteilt werden können.
  Ablage: `docs/screenshots/`, eingebunden über die `raw.githubusercontent.com`-URL
  mit dem Commit-SHA.
- **Immer einen PR erstellen oder aktualisieren**, damit die Arbeit gemergt
  werden kann.

### Screenshots erzeugen

Chromium ist vorinstalliert (`/opt/pw-browsers`), Playwright kommt aus dem
Scratchpad. Wichtig dabei:

- Spielstände über `context.addInitScript` in den localStorage schreiben
  (`parking-empire-save-v1`); ein `page.evaluate` nach dem Laden wird beim
  nächsten Reload vom `beforeunload`-Save überschrieben.
- `lastSavedAt` in der Seite stempeln, sonst öffnet das Offline-Modal.
- Das UI rendert jede Sekunde neu, deshalb `page.screenshot({ clip })` statt
  `locator.screenshot()` verwenden – sonst schlägt "element is not attached" zu.
- Für Zustände mit gleitender Auslastung ~20 s warten (Zeitkonstante 8 s).

## Tests

`npm test` deckt das Wirtschaftsmodell ab (`src/game.test.ts`) und spielt in
`src/balance.test.ts` eine Stunde mit vernünftiger Strategie durch. Änderungen an
Kosten, Nachfrage- oder Preisformeln immer gegen den Balance-Test prüfen.
