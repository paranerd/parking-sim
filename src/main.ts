import './styles.scss';
import {
  adjustHourlyPrice,
  advanceTime,
  buyUpgrade,
  GameState,
  incomePerSecond,
  maintenanceCost,
  performMaintenance,
  PRICE_STEP,
  repairIncident,
  simulateTick,
  UpgradeId,
  upgradeCost,
  upgrades,
} from './game';
import { loadGame, resetGame, saveGame } from './storage';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

const loaded = loadGame();
let state = loaded.state;
let selectedCategory: 'Alle' | 'Ausbau' | 'Service' | 'Automation' = 'Alle';
let muted = false;
let showOfflineModal = loaded.offlineEarned > 0.05;

const money = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const profitPerSecond = (game: GameState): string => `+ ${money(incomePerSecond(game))}`;
const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const percent = (value: number): string => `${Math.round(value)}%`;

const parkedCars = (game: GameState): string => Array.from({ length: game.spaces }, (_, index) => {
  const occupied = index < game.occupied;
  const colors = ['blue', 'cream', 'orange', 'green', 'purple'];
  const color = colors[index % colors.length];
  return `<div class="parking-space ${occupied ? 'occupied' : ''}"><span>${index + 1}</span>${occupied ? `<div class="car ${color}"><i></i><b></b></div>` : ''}</div>`;
}).join('');

/** Selector of the focused control so keyboard focus survives a re-render. */
const focusedSelector = (): string | null => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !app.contains(element)) return null;
  const key = (['priceStep', 'upgrade', 'action', 'filter'] as const).find((name) => element.dataset[name]);
  return key ? `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${element.dataset[key]}"]` : null;
};

const render = (): void => {
  const restoreFocus = focusedSelector();
  const occupancy = state.spaces ? state.occupied / state.spaces * 100 : 0;
  const filtered = upgrades.filter((upgrade) => selectedCategory === 'Alle' || upgrade.category === selectedCategory);
  const buildProgress = Math.min(100, state.spaces / 50 * 100);
  const nextDeck = 50 - state.spaces;

  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="Parking Empire Startseite"><span class="brand-mark">P</span><strong>Parking<br><em>Empire</em></strong></a>
      <div class="header-stats">
        <div><span>KONTOSTAND</span><strong data-live="cash">${money(state.cash)}</strong></div>
        <div><span>GEWINN / SEK.</span><strong class="positive" data-live="rate">${profitPerSecond(state)}</strong></div>
        <div><span>AUSLASTUNG</span><strong>${state.occupied} / ${state.spaces}</strong></div>
      </div>
      <div class="header-actions">
        <button class="icon-button" data-action="mute" aria-label="Ton ${muted ? 'einschalten' : 'ausschalten'}">${muted ? '╳' : '♫'}</button>
        <button class="icon-button" data-action="reset" aria-label="Spielstand zurücksetzen">↻</button>
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
            <div><span><i class="dot green-dot"></i>${state.occupied} belegt</span><span><i class="dot"></i>${state.spaces - state.occupied} frei</span></div>
            <span class="live"><i></i> LIVE-BETRIEB</span>
          </div>
        </div>

        <aside class="side-panel">
          <div class="panel-title"><div><span class="eyebrow">BETRIEB</span><h2>Heute im Blick</h2></div><span class="day-pill">TAG ${state.day}</span></div>
          <div class="metric"><div><span>Auslastung</span><strong>${Math.round(occupancy)}%</strong></div><div class="progress"><i style="width:${occupancy}%"></i></div><small>${state.occupied} von ${state.spaces} Plätzen belegt</small></div>
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
            <div><span>BEWERTUNG</span><strong>${state.reputation.toFixed(1)} <em>★</em></strong><small>${Math.max(4, state.carsServed + 14)} Rezensionen</small></div>
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
          <div class="filters">${(['Alle', 'Ausbau', 'Service', 'Automation'] as const).map(category => `<button class="${selectedCategory === category ? 'active' : ''}" data-filter="${category}">${category}</button>`).join('')}</div>
        </div>
        <div class="upgrade-grid">
          ${filtered.map(upgrade => {
            const level = state.levels[upgrade.id];
            const cost = upgradeCost(upgrade, level);
            const complete = upgrade.maxLevel !== null && level >= upgrade.maxLevel;
            const displayedLevels = upgrade.maxLevel === null ? 5 : Math.min(5, upgrade.maxLevel);
            return `<article class="upgrade-card ${state.cash >= cost && !complete ? 'affordable' : ''}">
              <div class="upgrade-icon">${upgrade.icon}</div>
              <div class="upgrade-copy"><span>${upgrade.category.toUpperCase()}</span><h3>${upgrade.name}</h3><p>${upgrade.description}</p><div class="level-dots">${Array.from({ length: displayedLevels }, (_, index) => `<i class="${upgrade.maxLevel === null ? 'filled endless' : index < level ? 'filled' : ''}"></i>`).join('')}<small>STUFE ${level}${upgrade.maxLevel === null ? ' · ∞' : `/${upgrade.maxLevel}`}</small></div></div>
              <button data-upgrade="${upgrade.id}" ${state.cash < cost || complete ? 'disabled' : ''}><span>${complete ? 'MAXIMAL' : 'VERBESSERN'}</span><strong>${complete ? '✓' : money(cost)}</strong></button>
            </article>`;
          }).join('')}
        </div>
      </section>

      <section class="activity">
        <div><span class="eyebrow">PARKPLATZ-CHRONIK</span><h2>Was gerade passiert</h2></div>
        <div class="log-list">${state.log.slice(0, 3).map((item, index) => `<p><i>${index === 0 ? '●' : '○'}</i>${item}<span>${index === 0 ? 'gerade eben' : 'vor kurzem'}</span></p>`).join('')}</div>
      </section>
    </main>
    <footer><div class="brand mini"><span class="brand-mark">P</span><strong>Parking <em>Empire</em></strong></div><p>Dein Parkplatz. Deine Regeln. Dein Imperium.</p><span>SPIELSTAND AUTOMATISCH GESPEICHERT</span></footer>
    ${showOfflineModal ? `<div class="modal-backdrop" id="offline-modal"><div class="modal"><span class="modal-icon">☀</span><span class="eyebrow">WILLKOMMEN ZURÜCK</span><h2>Dein Parkplatz war fleißig.</h2><p>Während deiner Abwesenheit von ${Math.round(loaded.offlineMinutes)} Minuten wurden Einnahmen erzielt.</p><strong>+ ${money(loaded.offlineEarned)}</strong><button data-action="close-modal">Weiterbauen</button></div></div>` : ''}
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
  if (target.dataset.action === 'reset' && window.confirm('Möchtest du wirklich neu anfangen?')) {
    resetGame();
    window.location.reload();
  }
  if (target.dataset.action !== 'close-modal') render();
});

/** Refreshes the values that grow continuously, without rebuilding the DOM. */
const renderLiveValues = (): void => {
  const cash = app.querySelector<HTMLElement>('[data-live="cash"]');
  if (cash) cash.textContent = money(state.cash);
  const clockNode = app.querySelector<HTMLElement>('[data-live="clock"]');
  if (clockNode) clockNode.textContent = clock(state.minuteOfDay);
  const rate = profitPerSecond(state);
  app.querySelectorAll<HTMLElement>('[data-live="rate"]').forEach((node) => { node.textContent = rate; });
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
