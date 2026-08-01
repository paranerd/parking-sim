import './styles.scss';
import {
  adjustHourlyPrice,
  advanceTime,
  buyUpgrade,
  demand,
  GameState,
  incomePerSecond,
  INITIAL_STATE,
  maintenanceCost,
  paymentRate,
  paymentStage,
  performMaintenance,
  PRICE_STEP,
  repairIncident,
  simulateTick,
  targetOccupancy,
  turnedAwayShare,
  UpgradeCategory,
  UpgradeId,
  upgradeCost,
  upgrades,
  willingnessToPay,
} from './game';
import { loadGame, resetGame, saveGame } from './storage';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

const categories: (UpgradeCategory | 'Alle')[] = ['Alle', 'Kapazität', 'Nachfrage', 'Erlös'];

const loaded = loadGame();
let state = loaded.state;
let selectedCategory: UpgradeCategory | 'Alle' = 'Alle';
let muted = false;
let showOfflineModal = loaded.offlineEarned > 0.05;
let askReset = false;

const money = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const profitPerSecond = (game: GameState): string => `+ ${money(incomePerSecond(game))}`;
const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const percent = (value: number): string => `${Math.round(value)}%`;
const cars = (value: number): string => value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Cars currently standing on the lot – the continuous occupancy made visible. */
const occupiedSpaces = (game: GameState): number => Math.round(game.occupancy * game.spaces);

/** Tells the player whether supply or demand is the current bottleneck. */
const marketHint = (game: GameState): string => {
  const turnedAway = turnedAwayShare(game);
  if (turnedAway > 0.15) return `${percent(turnedAway * 100)} der Gäste finden keinen Platz – du kannst mehr verlangen oder ausbauen`;
  if (turnedAway > 0.02) return `Ausgebucht – ${percent(turnedAway * 100)} finden keinen Platz und bewerten schlechter`;
  if (targetOccupancy(game) < 0.65) return 'Viele Plätze bleiben leer – ein günstigerer Tarif holt mehr Gäste';
  return 'Angebot und Nachfrage sind im Gleichgewicht';
};

const parkedCars = (game: GameState): string => {
  const occupied = occupiedSpaces(game);
  return Array.from({ length: game.spaces }, (_, index) => {
    const taken = index < occupied;
    const colors = ['blue', 'cream', 'orange', 'green', 'purple'];
    const color = colors[index % colors.length];
    return `<div class="parking-space ${taken ? 'occupied' : ''}"><span>${index + 1}</span>${taken ? `<div class="car ${color}"><i></i><b></b></div>` : ''}</div>`;
  }).join('');
};

/** Selector of the focused control so keyboard focus survives a re-render. */
const focusedSelector = (): string | null => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !app.contains(element)) return null;
  const key = (['priceStep', 'upgrade', 'action', 'filter'] as const).find((name) => element.dataset[name]);
  return key ? `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${element.dataset[key]}"]` : null;
};

const render = (): void => {
  const restoreFocus = focusedSelector();
  const occupancy = state.occupancy * 100;
  const wanted = demand(state);
  const demandShare = wanted / Math.max(1, state.spaces) * 100;
  const filtered = upgrades.filter((upgrade) => selectedCategory === 'Alle' || upgrade.category === selectedCategory);
  const buildProgress = Math.min(100, state.spaces / 50 * 100);
  const nextDeck = 50 - state.spaces;

  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="Parking Empire Startseite"><span class="brand-mark">P</span><strong>Parking<br><em>Empire</em></strong></a>
      <div class="header-stats">
        <div><span>KONTOSTAND</span><strong data-live="cash">${money(state.cash)}</strong></div>
        <div><span>GEWINN / SEK.</span><strong class="positive" data-live="rate">${profitPerSecond(state)}</strong></div>
        <div><span>AUSLASTUNG</span><strong data-live="occupancy">${percent(occupancy)}</strong></div>
      </div>
      <div class="header-actions">
        <button class="icon-button" data-action="mute" aria-label="Ton ${muted ? 'einschalten' : 'ausschalten'}">${muted ? '╳' : '♫'}</button>
        <button class="icon-button" data-action="ask-reset" aria-label="Spiel neu starten">↻</button>
        <div class="level-badge"><span>TAG</span><strong>${state.day}</strong></div>
      </div>
    </header>

    <main>
      <section class="hero-grid">
        <div class="parking-card">
          <div class="scene-head">
            <div><span class="eyebrow">DEIN STANDORT</span><h1>Sonnenallee 24</h1><p>Vorstadt · Stufe ${Math.max(1, Math.ceil(state.spaces / 15))}</p></div>
            <div class="weather"><span>☀</span><div><strong data-live="clock">${clock(state.minuteOfDay)}</strong><small>Sonnig · 22°C</small></div></div>
          </div>
          <div class="parking-scene">
            <div class="city city-left"></div><div class="city city-right"></div>
            <div class="road road-top"><span>BUS</span><i></i><i></i></div>
            <div class="lot">
              <div class="lot-sign"><b>P</b><span>PARKEN<br>FREI</span></div>
              <div class="spaces">${parkedCars(state)}</div>
              <div class="gate"><span></span><i></i></div>
              <div class="booth"><b>P</b><i></i></div>
            </div>
            <div class="road road-bottom"><div class="moving-car"></div></div>
          </div>
          <div class="scene-footer">
            <div><span><i class="dot green-dot"></i>${occupiedSpaces(state)} belegt</span><span><i class="dot"></i>${state.spaces - occupiedSpaces(state)} frei</span></div>
            <span class="live"><i></i> LIVE-BETRIEB</span>
          </div>
        </div>

        <aside class="side-panel">
          <div class="panel-title"><div><span class="eyebrow">BETRIEB</span><h2>Heute im Blick</h2></div><span class="day-pill">TAG ${state.day}</span></div>
          <div class="metric"><div><span>Auslastung</span><strong data-live="occupancy">${percent(occupancy)}</strong></div><div class="progress"><i data-live="occupancy-bar" style="width:${occupancy}%"></i></div><small><b data-live="capacity">${cars(state.occupancy * state.spaces)}</b> von ${state.spaces} ${state.spaces === 1 ? 'Platz' : 'Plätzen'} belegt</small></div>
          <div class="metric"><div><span>Nachfrage</span><strong data-live="demand">${percent(demandShare)}</strong></div><div class="progress ${demandShare > 100 ? 'amber' : ''}"><i data-live="demand-bar" style="width:${Math.min(100, demandShare)}%"></i></div><small><b data-live="demand-cars">${cars(wanted)}</b> Autos suchen einen Platz</small></div>
          <div class="market-hint ${turnedAwayShare(state) > 0.02 ? 'tight' : ''}" data-live="market-hint">${marketHint(state)}</div>
          <div class="quick-stats">
            <div class="price-setting">
              <span id="price-label">PREIS / STD.</span>
              <div class="price-stepper" role="group" aria-labelledby="price-label">
                <button type="button" data-price-step="-1" aria-label="Preis um ${money(PRICE_STEP)} senken" ${state.price <= 0 ? 'disabled' : ''}>−</button>
                <strong aria-live="polite">${money(state.price)}</strong>
                <button type="button" data-price-step="1" aria-label="Preis um ${money(PRICE_STEP)} erhöhen">+</button>
              </div>
              <small>Gewinn <b class="positive" data-live="rate">${profitPerSecond(state)}</b> / Sek.</small>
            </div>
            <div><span>BEWERTUNG</span><strong><b data-live="reputation">${state.reputation.toFixed(1)}</b> <em>★</em></strong><small>${Math.max(4, Math.floor(state.carsServed) + 14)} Rezensionen</small></div>
            <div><span>ZAHLUNGSBEREITSCHAFT</span><strong>${money(willingnessToPay(state))}</strong><small>Tarif ohne Murren pro Stunde</small></div>
            <div><span>ZAHLUNGSQUOTE</span><strong>${percent(paymentRate(state) * 100)}</strong><small>${paymentStage(state).name}</small></div>
          </div>
          <div class="condition">
            <div><span>Anlagenzustand</span><strong>${percent(state.condition)}</strong></div>
            <div class="progress amber"><i style="width:${state.condition}%"></i></div>
            <button class="text-button" data-action="maintenance" ${state.cash < maintenanceCost(state) || state.condition >= 99 ? 'disabled' : ''}>Wartung durchführen · ${money(maintenanceCost(state))}</button>
          </div>
          ${state.activeIncident ? `<div class="incident"><div class="incident-icon">!</div><div><strong>${state.activeIncident.title}</strong><p>${state.activeIncident.description}</p><button data-action="repair" ${state.cash < state.activeIncident.repairCost ? 'disabled' : ''}>Jetzt reparieren · ${money(state.activeIncident.repairCost)}</button></div></div>` : `<div class="all-good"><span>✓</span><div><strong>Alles läuft rund</strong><small>Keine offenen Störungen</small></div></div>`}
          <div class="next-goal"><span>NÄCHSTES ZIEL</span><div><strong>Das erste Parkdeck</strong><b>${Math.round(buildProgress)}%</b></div><div class="progress dark"><i style="width:${buildProgress}%"></i></div><small>${nextDeck > 0 ? `Noch ${nextDeck} Stellplätze bis zum Ausbau` : 'Bereit für die nächste Ausbaustufe!'}</small></div>
        </aside>
      </section>

      <section class="upgrades-section">
        <div class="section-heading"><div><span class="eyebrow">INVESTIEREN & WACHSEN</span><h2>Verbesserungen</h2><p>Baue deinen Standort aus und steigere deinen Gewinn.</p></div>
          <div class="filters">${categories.map(category => `<button class="${selectedCategory === category ? 'active' : ''}" data-filter="${category}">${category}</button>`).join('')}</div>
        </div>
        <div class="upgrade-grid">
          ${filtered.map(upgrade => {
            const level = state.levels[upgrade.id];
            const cost = upgradeCost(upgrade, level);
            const complete = upgrade.maxLevel !== null && level >= upgrade.maxLevel;
            const displayedLevels = upgrade.maxLevel === null ? 5 : Math.min(5, upgrade.maxLevel);
            // Staged upgrades replace themselves, so the card names what comes next.
            const stage = upgrade.stages ? `<em>Jetzt: ${upgrade.stages[level]}${complete ? '' : ` · Nächste Stufe: ${upgrade.stages[level + 1]}`}</em>` : '';
            return `<article class="upgrade-card ${state.cash >= cost && !complete ? 'affordable' : ''}">
              <div class="upgrade-icon">${upgrade.icon}</div>
              <div class="upgrade-copy"><span>${upgrade.category.toUpperCase()}</span><h3>${upgrade.name}</h3><p>${upgrade.description}${stage}</p><div class="level-dots">${Array.from({ length: displayedLevels }, (_, index) => `<i class="${upgrade.maxLevel === null ? 'filled endless' : index < level ? 'filled' : ''}"></i>`).join('')}<small>STUFE ${level}${upgrade.maxLevel === null ? ' · ∞' : `/${upgrade.maxLevel}`}</small></div></div>
              <button data-upgrade="${upgrade.id}" ${state.cash < cost || complete ? 'disabled' : ''}><span>${complete ? 'MAXIMAL' : 'VERBESSERN'}</span><strong>${complete ? '✓' : money(cost)}</strong></button>
            </article>`;
          }).join('')}
        </div>
      </section>

    </main>
    <footer>
      <div class="brand mini"><span class="brand-mark">P</span><strong>Parking <em>Empire</em></strong></div>
      <p>Dein Parkplatz. Deine Regeln. Dein Imperium.</p>
      <button class="restart-button" data-action="ask-reset">Spiel neu starten</button>
      <span>SPIELSTAND AUTOMATISCH GESPEICHERT</span>
    </footer>
    ${showOfflineModal ? `<div class="modal-backdrop" id="offline-modal"><div class="modal"><span class="modal-icon">☀</span><span class="eyebrow">WILLKOMMEN ZURÜCK</span><h2>Dein Parkplatz war fleißig.</h2><p>Während deiner Abwesenheit von ${Math.round(loaded.offlineMinutes)} Minuten wurden Einnahmen erzielt.</p><strong>+ ${money(loaded.offlineEarned)}</strong><button data-action="close-modal">Weiterbauen</button></div></div>` : ''}
    ${askReset ? `<div class="modal-backdrop" id="reset-modal"><div class="modal"><span class="modal-icon warn">↻</span><span class="eyebrow">NEU STARTEN</span><h2>Wirklich von vorn beginnen?</h2><p>Dein Spielstand von Tag ${state.day} mit ${state.spaces} ${state.spaces === 1 ? 'Stellplatz' : 'Stellplätzen'} und ${money(state.cash)} wird endgültig gelöscht.</p><div class="modal-actions"><button class="ghost" data-action="cancel-reset">Abbrechen</button><button data-action="confirm-reset">Ja, neu starten</button></div></div></div>` : ''}
  `;

  if (restoreFocus) app.querySelector<HTMLElement>(restoreFocus)?.focus();
};

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a');
  if (!target) return;
  if (target.matches('a')) event.preventDefault();
  const filter = target.dataset.filter as typeof selectedCategory | undefined;
  const upgrade = target.dataset.upgrade as UpgradeId | undefined;
  const priceStep = target.dataset.priceStep;
  if (filter) selectedCategory = filter;
  if (upgrade) state = buyUpgrade(state, upgrade);
  if (priceStep) state = adjustHourlyPrice(state, Number(priceStep));
  if (target.dataset.action === 'repair') state = repairIncident(state);
  if (target.dataset.action === 'maintenance') state = performMaintenance(state);
  if (target.dataset.action === 'mute') muted = !muted;
  if (target.dataset.action === 'close-modal') {
    showOfflineModal = false;
    document.querySelector('#offline-modal')?.remove();
  }
  if (target.dataset.action === 'ask-reset') askReset = true;
  if (target.dataset.action === 'cancel-reset') askReset = false;
  if (target.dataset.action === 'confirm-reset') restartGame();
  if (target.dataset.action !== 'close-modal') render();
});

/** Wipes the save and starts a brand new parking lot without a page reload. */
const restartGame = (): void => {
  resetGame();
  state = { ...structuredClone(INITIAL_STATE), lastSavedAt: Date.now() };
  selectedCategory = 'Alle';
  askReset = false;
  showOfflineModal = false;
  lastStep = performance.now();
  pendingTicks = 0;
  saveGame(state);
};

const setLive = (name: string, text: string): void => {
  app.querySelectorAll<HTMLElement>(`[data-live="${name}"]`).forEach((node) => { node.textContent = text; });
};

/**
 * Refreshes everything that flows – cash, occupancy, demand – without
 * rebuilding the DOM, so the numbers move smoothly between the event ticks.
 */
const renderLiveValues = (): void => {
  setLive('cash', money(state.cash));
  setLive('clock', clock(state.minuteOfDay));
  setLive('rate', profitPerSecond(state));
  setLive('reputation', state.reputation.toFixed(1));

  const occupancy = state.occupancy * 100;
  setLive('occupancy', percent(occupancy));
  setLive('capacity', cars(state.occupancy * state.spaces));
  const occupancyBar = app.querySelector<HTMLElement>('[data-live="occupancy-bar"]');
  if (occupancyBar) occupancyBar.style.width = `${occupancy}%`;

  const wanted = demand(state);
  const demandShare = wanted / Math.max(1, state.spaces) * 100;
  setLive('demand', percent(demandShare));
  setLive('demand-cars', cars(wanted));
  const demandBar = app.querySelector<HTMLElement>('[data-live="demand-bar"]');
  if (demandBar) {
    demandBar.style.width = `${Math.min(100, demandShare)}%`;
    demandBar.parentElement?.classList.toggle('amber', demandShare > 100);
  }

  const hint = app.querySelector<HTMLElement>('[data-live="market-hint"]');
  if (hint) {
    hint.textContent = marketHint(state);
    hint.classList.toggle('tight', turnedAwayShare(state) > 0.02);
  }
};

let lastStep = performance.now();
let pendingTicks = 0;

/** Books the elapsed real time; income accrues per frame, events once per second. */
const step = (now = performance.now()): void => {
  const elapsed = Math.min(2, Math.max(0, (now - lastStep) / 1000));
  lastStep = now;
  if (elapsed <= 0) return;

  state = advanceTime(state, elapsed);
  pendingTicks += elapsed;
  let ticked = false;
  while (pendingTicks >= 1) {
    pendingTicks -= 1;
    state = simulateTick(state);
    ticked = true;
  }

  if (ticked) render();
  else renderLiveValues();
};

render();

// The animation frame keeps the counters smooth, the interval keeps the
// simulation running while the tab is in the background.
const frame = (now: number): void => {
  step(now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
setInterval(() => step(), 1000);
setInterval(() => saveGame(state), 5000);
window.addEventListener('beforeunload', () => saveGame(state));
