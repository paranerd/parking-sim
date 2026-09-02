import './styles.scss';
import {
  adjustHourlyPrice,
  advanceTime,
  attraction,
  AWAY_CAP_MINUTES,
  AwayReport,
  BASE_WILLINGNESS,
  buyUpgrade,
  currentLocation,
  demand,
  equipmentFactor,
  fixedCostItems,
  fixedCostPerHour,
  GameState,
  maintenanceCost,
  occupancy,
  paymentRate,
  paymentStage,
  performMaintenance,
  PRICE_STEP,
  profitPerHour,
  repairIncident,
  reputationFactor,
  revenuePerHour,
  runningCostChange,
  setHourlyPrice,
  simulateAway,
  simulateTick,
  turnedAwayShare,
  UpgradeCategory,
  UpgradeId,
  upgradeCost,
  upgrades,
  willingnessToPay,
} from './game';
import { loadGame, saveGame } from './storage';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App container not found');

const AWAY_MODAL_MINUTES = 60;
const loaded = loadGame();
let state = loaded.state;
let awayReport: AwayReport | null = loaded.away && loaded.away.awayMinutes >= AWAY_MODAL_MINUTES ? loaded.away : null;
let showProfitModal = false;
let showDemandModal = false;
let showPriceModal = false;
type ChartMetric = 'revenue' | 'occupancy' | 'demand' | 'turnedAway';
let selectedMetric: ChartMetric = 'revenue';
type UpgradeFilter = 'Alle' | UpgradeCategory;
const upgradeFilters: UpgradeFilter[] = ['Alle', 'Standort', 'Kapazität', 'Nachfrage', 'Erlös'];
let selectedUpgradeFilter: UpgradeFilter = 'Alle';

const money = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const hourlyMoney = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h`;
const signedMoney = (value: number): string => `${value < 0 ? '−' : '+'} ${money(Math.abs(value))}`;
const percent = (value: number): string => `${Math.round(value)}%`;
const cars = (value: number): string => value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const countdown = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, Math.round(seconds % 60))).padStart(2, '0')}`;

const duration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${Math.max(1, rest)} Minuten`;
  return rest === 0 ? `${hours} Stunden` : `${hours} Std. ${rest} Min.`;
};

const awayModal = (report: AwayReport): string => `<div class="modal-backdrop" id="away-modal">
  <div class="modal wide">
    <span class="modal-icon ${report.earned < 0 ? 'warn' : ''}">${report.earned < 0 ? '!' : '☀'}</span>
    <span class="eyebrow">WILLKOMMEN ZURÜCK</span>
    <h2 class="${report.earned < 0 ? 'negative' : ''}">${report.earned < 0 ? 'Die Kosten liefen weiter.' : 'Dein Parkplatz hat weitergearbeitet.'}</h2>
    <p>Du warst ${report.capped ? `mehr als ${AWAY_CAP_MINUTES / 60} Stunden` : duration(report.awayMinutes)} weg${report.capped ? ` – angerechnet werden die letzten ${AWAY_CAP_MINUTES / 60} Stunden` : ''}. In der Zeit vergingen ${Math.round(report.gameHours)} Spielstunden.</p>
    <table class="ledger">
      <tr><td>Umsatz <em>(${percent(report.attendedShare * 100)} ohne Aufsicht kassiert)</em></td><td>${money(report.revenue)}</td></tr>
      <tr><td>Kosten <em>(Miete, Fläche, Personal)</em></td><td>${money(report.costs)}</td></tr>
      <tr class="total"><td>${report.earned < 0 ? 'Verlust' : 'Gewinn'}</td><td class="${report.earned < 0 ? 'negative' : ''}">${signedMoney(report.earned)}</td></tr>
      <tr class="section"><th colspan="2">Was sonst passiert ist</th></tr>
      <tr><td>Vergangene Spieltage</td><td>${report.gameDays}</td></tr>
      <tr><td>Bediente Autos</td><td>${Math.round(report.cars)}</td></tr>
      <tr><td>Auslastung</td><td>${percent(report.occupancy * 100)}</td></tr>
    </table>
    ${report.earned < 0 ? '<p class="note">Miete und laufende Kosten fallen auch ohne Gäste an. Ein besserer Tarif oder weniger Leerstand hilft.</p>' : ''}
    <button data-action="close-away">Weiterarbeiten</button>
  </div>
</div>`;

const profitModal = (game: GameState): string => {
  const revenue = revenuePerHour(game);
  const costs = fixedCostPerHour(game);
  const profit = profitPerHour(game);
  return `<div class="modal-backdrop" id="profit-modal"><div class="modal wide">
    <span class="eyebrow">BILANZ</span><h2 class="${profit < 0 ? 'negative' : 'positive'}">${signedMoney(profit)} pro Stunde</h2>
    <table class="ledger">
      <tr class="section"><th colspan="2">Umsatz</th></tr><tr><td>Preis pro Stunde</td><td>${money(game.price)}</td></tr>
      <tr><td>Stellplätze</td><td>× ${game.spaces}</td></tr><tr><td>Belegung</td><td>× ${percent(occupancy(game) * 100)}</td></tr>
      <tr><td>Zahlungsquote <em>(${paymentStage(game).name})</em></td><td>× ${percent(paymentRate(game) * 100)}</td></tr>
      <tr class="sum"><td>Umsatz pro Stunde</td><td>${money(revenue)}</td></tr><tr class="section"><th colspan="2">Kosten</th></tr>
      ${fixedCostItems(game).map((item) => `<tr><td>${item.label}</td><td>${money(item.amount)}</td></tr>`).join('')}
      <tr class="sum"><td>Kosten pro Stunde</td><td>${money(costs)}</td></tr><tr class="section"><th colspan="2">Ergebnis</th></tr>
      <tr class="total"><td>${money(revenue)} Umsatz − ${money(costs)} Kosten</td><td class="${profit < 0 ? 'negative' : ''}">${signedMoney(profit)}</td></tr>
    </table><button data-action="close-profit">Schließen</button>
  </div></div>`;
};

const demandModal = (game: GameState): string => {
  const wanted = demand(game);
  const priceFactor = attraction(game) > 0 ? wanted / attraction(game) : 1;
  const share = wanted / Math.max(1, game.spaces) * 100;
  const turnedAway = turnedAwayShare(game);
  return `<div class="modal-backdrop" id="demand-modal"><div class="modal wide">
    <span class="eyebrow">NACHFRAGE</span><h2>${cars(wanted)} Autos suchen einen Platz</h2>
    <table class="ledger"><tr class="section"><th colspan="2">Einflussfaktoren</th></tr>
      <tr><td>Basis-Nachfrage <em>(${currentLocation(game).name})</em></td><td>${cars(currentLocation(game).baseDemand)} Autos</td></tr>
      <tr><td>Bewertung <em>(${game.reputation.toFixed(1)} ★)</em></td><td>× ${percent(reputationFactor(game) * 100)}</td></tr>
      <tr><td>Werbung und Ausstattung</td><td>× ${percent(equipmentFactor(game) * 100)}</td></tr>
      ${game.activeEvent ? `<tr><td>${game.activeEvent.title} <em>(noch ${countdown(game.activeEvent.secondsLeft)})</em></td><td>× ${percent(game.activeEvent.factor * 100)}</td></tr>` : ''}
      <tr><td>Preis <em>(${money(game.price)} gegen ${money(willingnessToPay(game))} Zahlungsbereitschaft)</em></td><td>× ${percent(priceFactor * 100)}</td></tr>
      <tr class="sum"><td>Autos, die parken wollen</td><td>${cars(wanted)}</td></tr><tr class="section"><th colspan="2">Kapazität</th></tr>
      <tr class="total"><td>${game.spaces} Stellplätze</td><td>${percent(Math.min(100, share))} belegt</td></tr>
    </table>
    <p class="note"><b>Zahlungsbereitschaft:</b> ${money(BASE_WILLINGNESS)} gelten als fairer Basistarif. Standort und Ausstattung können diesen Wert erhöhen.</p>
    <p class="note">${turnedAway > 0.02 ? `${percent(turnedAway * 100)} der Interessenten finden aktuell keinen Platz.` : 'Angebot und Nachfrage sind im Gleichgewicht.'}</p>
    <button data-action="close-demand">Schließen</button>
  </div></div>`;
};

const priceModal = (game: GameState): string => `<div class="modal-backdrop" id="price-modal">
  <form class="modal price-modal" id="price-form">
    <span class="eyebrow">TARIFSTEUERUNG</span>
    <h2>Ticket-Preis festlegen</h2>
    <p>Lege den Preis pro Stunde direkt fest.</p>
    <label class="price-input-label" for="price-input">Preis pro Stunde</label>
    <div class="price-input"><input id="price-input" name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${game.price.toFixed(2)}" required><span>€</span></div>
    <div class="modal-actions"><button type="button" data-action="close-price">Abbrechen</button><button type="submit">Übernehmen</button></div>
  </form>
</div>`;

const chartMetrics: { id: ChartMetric; label: string }[] = [
  { id: 'revenue', label: 'Umsatz / h' }, { id: 'occupancy', label: 'Belegung' },
  { id: 'demand', label: 'Nachfrage' }, { id: 'turnedAway', label: 'Abgewiesen' },
];

/** Projected daily profile based on the current operating settings. */
const DAY_PROFILE = [0.04, 0.03, 0.03, 0.04, 0.07, 0.15, 0.3, 0.48, 0.66, 0.78, 0.84, 0.88, 0.9, 0.92, 0.98, 1, 0.95, 0.89, 0.8, 0.68, 0.53, 0.37, 0.22, 0.1, 0.04];

const chartBaseValue = (game: GameState, metric: ChartMetric): number => {
  if (metric === 'revenue') return revenuePerHour(game);
  if (metric === 'occupancy') return occupancy(game) * 100;
  if (metric === 'demand') return demand(game) / Math.max(1, game.spaces) * 100;
  return turnedAwayShare(game) * 100;
};

const chartValue = (value: number, metric: ChartMetric): string => metric === 'revenue' ? `${Math.round(value)} €` : `${Math.round(value)}%`;

const chart = (game: GameState): string => {
  const base = chartBaseValue(game, selectedMetric);
  const values = DAY_PROFILE.map((factor) => base * factor);
  const rawMax = Math.max(...values, selectedMetric === 'revenue' ? 10 : 100);
  const maximum = Math.ceil(rawMax / 10) * 10;
  const left = 54;
  const top = 25;
  const width = 686;
  const height = 205;
  const points = values.map((value, index) => ({ x: left + index / (values.length - 1) * width, y: top + height - value / maximum * height }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${left + width} ${top + height} L ${left} ${top + height} Z`;
  const grid = [0, .25, .5, .75, 1].map((share) => {
    const y = top + height - share * height;
    return `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}"></line><text x="0" y="${y + 4}">${chartValue(maximum * share, selectedMetric)}</text>`;
  }).join('');
  const markerX = left + game.minuteOfDay / 1440 * width;
  const markerY = top + height - Math.min(maximum, base) / maximum * height;
  return `<svg class="trend-chart" viewBox="0 0 760 265" role="img" aria-label="Prognostiziertes Tagesprofil ${chartMetrics.find((metric) => metric.id === selectedMetric)?.label}">
    <g class="chart-grid">${grid}</g><path class="chart-area" d="${area}"></path><path class="chart-line" d="${line}"></path>
    <g class="chart-marker"><line x1="${markerX}" y1="${top}" x2="${markerX}" y2="${top + height}"></line><circle cx="${markerX}" cy="${markerY}" r="4"></circle><text x="${Math.min(markerX + 7, left + width - 92)}" y="17">Preis ${money(game.price)}</text></g>
    <g class="chart-times"><text x="${left}" y="258">00:00</text><text x="${left + width / 3}" y="258">08:00</text><text x="${left + width * 2 / 3}" y="258">16:00</text><text x="${left + width}" y="258" text-anchor="end">24:00</text></g>
  </svg>`;
};

const focusedSelector = (): string | null => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !app.contains(element) || !element.matches(':focus-visible')) return null;
  const key = (['priceStep', 'upgrade', 'filter', 'action', 'metric'] as const).find((name) => element.dataset[name]);
  return key ? `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${element.dataset[key]}"]` : null;
};

const structureKey = (): string => [
  state.spaces, state.day, selectedMetric, selectedUpgradeFilter, showProfitModal, showDemandModal, showPriceModal, awayReport !== null,
  state.activeIncident?.id ?? '-', state.activeEvent?.id ?? '-', state.price <= 0,
  Object.values(state.levels).join(','),
  upgrades.map((upgrade) => state.cash >= upgradeCost(upgrade, state.levels[upgrade.id])).join(''),
  state.cash >= maintenanceCost(state), state.condition >= 99,
  state.activeIncident ? state.cash >= state.activeIncident.repairCost : false,
].join('|');

let renderedKey = '';
let pointerHeld = false;
let renderPending = false;

const render = (): void => {
  if (pointerHeld) { renderPending = true; return; }
  renderPending = false;
  renderedKey = structureKey();
  const restoreFocus = focusedSelector();
  const filled = occupancy(state) * 100;
  const occupiedSpaces = Math.round(occupancy(state) * state.spaces);
  const freeSpaces = Math.max(0, state.spaces - occupiedSpaces);
  const demandShare = demand(state) / Math.max(1, state.spaces) * 100;
  const eventTone = state.activeEvent?.factor && state.activeEvent.factor < 1 ? 'bad' : 'good';
  const visibleUpgrades = upgrades
    .filter((upgrade) => selectedUpgradeFilter === 'Alle' || upgrade.category === selectedUpgradeFilter)
    .sort((first, second) => upgradeCost(first, state.levels[first.id]) - upgradeCost(second, state.levels[second.id]));

  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#overview" data-action="focus-overview" aria-label="Parking Empire Übersicht"><span class="brand-mark">P</span><strong>Parking<br><em>Empire</em></strong></a>
        <div class="header-actions"><button class="cash-stat" data-action="explain-profit" aria-haspopup="dialog" title="Bilanz öffnen"><span>KONTOSTAND</span><strong data-live="cash">${money(state.cash)}</strong><small data-live="revenue">${hourlyMoney(revenuePerHour(state))}</small></button><div class="level-badge"><span>TAG</span><strong>${state.day}</strong></div></div>
      </div>
    </header>

    <main class="dashboard" id="overview" tabindex="-1">
      <section class="kpi-strip" aria-label="Betriebskennzahlen">
        <article class="kpi"><span class="kpi-icon">◕</span><div><span>AUSLASTUNG</span><strong data-live="occupancy">${percent(filled)}</strong><small><b data-live="free-spaces">${freeSpaces}</b> frei · ${state.spaces} gesamt</small></div></article>
        <button class="kpi" data-action="explain-demand" aria-haspopup="dialog"><span class="kpi-icon">↗</span><div><span>NACHFRAGE</span><strong data-live="demand">${percent(demandShare)}</strong></div></button>
        <article class="kpi condition-kpi"><span class="kpi-icon">⌕</span><div><span>ANLAGENZUSTAND</span><strong data-live="condition">${percent(state.condition)}</strong>${state.condition < 99 ? `<button data-action="maintenance" ${state.cash < maintenanceCost(state) ? 'disabled' : ''}>Wartung · <span data-live="maintenance">${money(maintenanceCost(state))}</span></button>` : '<small>Kein Wartungsbedarf</small>'}</div></article>
        <article class="kpi"><span class="kpi-icon">★</span><div><span>BEWERTUNG</span><strong><b data-live="reputation">${state.reputation.toFixed(1)}</b> <em>★</em></strong></div></article>
      </section>

      <section class="dashboard-grid">
        <div class="operations-grid">
          <section class="dashboard-card notifications" id="notifications" tabindex="-1">
            <div class="card-heading"><div><span class="eyebrow">${currentLocation(state).address} · ${state.spaces} Plätze</span><h2>Meldungen & Aktionen</h2></div></div>
            ${state.activeEvent ? `<article class="notification ${eventTone}"><div class="notification-top"><span class="notice-icon">${eventTone === 'bad' ? '☂' : '↗'}</span><div><span class="badge">AKTIV</span><h3>${state.activeEvent.title}</h3><p>${state.activeEvent.description}</p></div></div><div class="notification-effect"><strong>Nachfrage × ${state.activeEvent.factor.toLocaleString('de-DE')}</strong><span data-live="event-time">noch ${countdown(state.activeEvent.secondsLeft)}</span></div></article>` : `<article class="notification calm"><div class="notification-top"><span class="notice-icon">✓</span><div><h3>Keine Meldungen</h3></div></div></article>`}
            ${state.activeIncident ? `<div class="status-strip incident-strip"><span>!</span><div><strong>${state.activeIncident.title}</strong><small>${state.activeIncident.description}</small></div><button data-action="repair" ${state.cash < state.activeIncident.repairCost ? 'disabled' : ''}>Reparieren · ${money(state.activeIncident.repairCost)}</button></div>` : ''}
          </section>

          <section class="dashboard-card ticket-card" aria-labelledby="price-label">
            <div class="card-heading"><div><span class="eyebrow">TARIFSTEUERUNG</span><h2 id="price-label">Ticket-Preis</h2></div></div>
            <div class="price-panel"><div class="price-stepper" role="group" aria-labelledby="price-label"><button type="button" data-price-step="-1" aria-label="Preis um ${money(PRICE_STEP)} senken" ${state.price <= 0 ? 'disabled' : ''}>−</button><button type="button" class="price-value" data-action="edit-price" aria-haspopup="dialog" aria-label="Ticket-Preis manuell eingeben"><strong aria-live="polite" data-live="price">${money(state.price)}</strong></button><button type="button" data-price-step="1" aria-label="Preis um ${money(PRICE_STEP)} erhöhen">+</button></div></div>
          </section>
        </div>

        <section class="dashboard-card chart-card">
          <div class="card-heading chart-heading"><div><span class="eyebrow">PROGNOSE MIT AKTUELLEN EINSTELLUNGEN</span><h2>Verlauf</h2></div><div class="range-buttons" aria-label="Zeitraum"><button class="active">24 h</button><button disabled>7 Tage</button><button disabled>30 Tage</button></div></div>
          <div class="metric-tabs" role="tablist">${chartMetrics.map((metric) => `<button role="tab" aria-selected="${selectedMetric === metric.id}" class="${selectedMetric === metric.id ? 'active' : ''}" data-metric="${metric.id}">${metric.label}</button>`).join('')}</div>${chart(state)}
        </section>

        <aside class="dashboard-card upgrades-panel" id="upgrades" tabindex="-1">
          <div class="card-heading"><div><span class="eyebrow">INVESTIEREN & WACHSEN</span><h2>Verbesserungen</h2></div></div>
          <div class="upgrade-filters" role="group" aria-label="Verbesserungen filtern">${upgradeFilters.map((filter) => `<button class="${selectedUpgradeFilter === filter ? 'active' : ''}" data-action="filter-upgrades" data-filter="${filter}">${filter}</button>`).join('')}</div>
          <div class="upgrade-list">${visibleUpgrades.map((upgrade) => {
            const level = state.levels[upgrade.id];
            const cost = upgradeCost(upgrade, level);
            const complete = upgrade.maxLevel !== null && level >= upgrade.maxLevel;
            const stage = upgrade.stages ? `<em>Jetzt: ${upgrade.stages[level]}${complete ? '' : ` · Nächste Stufe: ${upgrade.stages[level + 1]}`}</em>` : '';
            const running = complete ? 0 : runningCostChange(state, upgrade.id);
            const runningNote = Math.abs(running) < 0.005 ? '' : `<em class="${running > 0 ? 'cost' : 'positive'}">${running > 0 ? '+' : '−'} ${money(Math.abs(running))} Fixkosten / Std.</em>`;
            return `<article class="upgrade-row ${state.cash >= cost && !complete ? 'affordable' : ''}"><div class="upgrade-icon">${upgrade.icon}</div><div class="upgrade-copy"><span>${upgrade.category.toUpperCase()} · STUFE ${level}${upgrade.maxLevel === null ? ' · ∞' : `/${upgrade.maxLevel}`}</span><h3>${upgrade.name}</h3><p>${upgrade.description}${stage}${runningNote}</p></div><div class="upgrade-buy"><strong>${complete ? '✓' : money(cost)}</strong><button data-upgrade="${upgrade.id}" ${state.cash < cost || complete ? 'disabled' : ''}>${complete ? 'MAXIMAL' : 'KAUFEN'}</button></div></article>`;
          }).join('')}</div>
        </aside>
      </section>
    </main>
    ${awayReport ? awayModal(awayReport) : ''}${showProfitModal ? profitModal(state) : ''}${showDemandModal ? demandModal(state) : ''}${showPriceModal ? priceModal(state) : ''}`;

  if (restoreFocus) app.querySelector<HTMLElement>(restoreFocus)?.focus();
};

let holdTimer: number | undefined;
let repeated = false;
const stopHold = (): void => { window.clearTimeout(holdTimer); holdTimer = undefined; };
const startHold = (steps: number): void => {
  stopHold();
  let delay = 380;
  const repeat = (): void => {
    const before = state.price;
    state = adjustHourlyPrice(state, steps);
    if (state.price === before) return stopHold();
    repeated = true;
    renderLiveValues();
    delay = Math.max(45, delay * 0.72);
    holdTimer = window.setTimeout(repeat, delay);
  };
  holdTimer = window.setTimeout(repeat, delay);
};

app.addEventListener('pointerdown', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-price-step]');
  if (!button || (button as HTMLButtonElement).disabled) return;
  pointerHeld = true;
  startHold(Number(button.dataset.priceStep));
});
const releasePointer = (): void => { stopHold(); pointerHeld = false; if (renderPending) render(); };
document.addEventListener('pointerup', releasePointer);
document.addEventListener('pointercancel', releasePointer);
window.addEventListener('blur', releasePointer);

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a');
  if (!target) return;
  if (target.matches('a')) event.preventDefault();
  if (target instanceof HTMLButtonElement && target.type === 'submit' && target.form) return;
  const upgrade = target.dataset.upgrade as UpgradeId | undefined;
  const priceStep = target.dataset.priceStep;
  const upgradeFilter = target.dataset.filter as UpgradeFilter | undefined;
  const metric = target.dataset.metric as ChartMetric | undefined;
  const action = target.dataset.action;
  if (upgrade) state = buyUpgrade(state, upgrade);
  if (metric && chartMetrics.some((option) => option.id === metric)) selectedMetric = metric;
  if (action === 'filter-upgrades' && upgradeFilter && upgradeFilters.includes(upgradeFilter)) selectedUpgradeFilter = upgradeFilter;
  if (priceStep && !repeated) state = adjustHourlyPrice(state, Number(priceStep));
  repeated = false;
  if (action === 'repair') state = repairIncident(state);
  if (action === 'maintenance') state = performMaintenance(state);
  if (action === 'close-away') awayReport = null;
  if (action === 'explain-profit') showProfitModal = true;
  if (action === 'close-profit') showProfitModal = false;
  if (action === 'explain-demand') showDemandModal = true;
  if (action === 'close-demand') showDemandModal = false;
  if (action === 'edit-price') showPriceModal = true;
  if (action === 'close-price') showPriceModal = false;
  render();
  const focusTarget = action === 'focus-upgrades' ? 'upgrades' : action === 'focus-notifications' ? 'notifications' : action === 'focus-overview' ? 'overview' : null;
  if (focusTarget) requestAnimationFrame(() => document.getElementById(focusTarget)?.focus());
  if (action === 'edit-price') requestAnimationFrame(() => { const input = document.querySelector<HTMLInputElement>('#price-input'); input?.focus(); input?.select(); });
});

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'price-form') return;
  event.preventDefault();
  const input = form.elements.namedItem('price') as HTMLInputElement | null;
  const price = Number(input?.value.replace(',', '.'));
  if (!input || !Number.isFinite(price) || price < 0) {
    input?.setCustomValidity('Bitte gib einen gültigen Preis ab 0,00 € ein.');
    input?.reportValidity();
    return;
  }
  state = setHourlyPrice(state, price);
  showPriceModal = false;
  render();
});

const setLive = (name: string, text: string): void => { app.querySelectorAll<HTMLElement>(`[data-live="${name}"]`).forEach((node) => { node.textContent = text; }); };
const renderLiveValues = (): void => {
  setLive('cash', money(state.cash));
  setLive('revenue', hourlyMoney(revenuePerHour(state)));
  setLive('reputation', state.reputation.toFixed(1));
  setLive('occupancy', percent(occupancy(state) * 100));
  setLive('free-spaces', String(Math.max(0, state.spaces - Math.round(occupancy(state) * state.spaces))));
  setLive('demand', percent(demand(state) / Math.max(1, state.spaces) * 100));
  setLive('price', money(state.price));
  setLive('maintenance', money(maintenanceCost(state)));
  setLive('condition', percent(state.condition));
  if (state.activeEvent) setLive('event-time', `noch ${countdown(state.activeEvent.secondsLeft)}`);
};

let lastStep = performance.now();
let pendingTicks = 0;
let hiddenSince = 0;
const AWAY_THRESHOLD_SECONDS = 45;
const bookAway = (seconds: number): void => {
  const report = simulateAway(state, seconds / 60);
  state = report.state;
  if (report.awayMinutes >= AWAY_MODAL_MINUTES) awayReport = report;
  saveGame(state);
  render();
};

const step = (now = performance.now()): void => {
  if (document.hidden) return;
  const elapsed = Math.max(0, (now - lastStep) / 1000);
  lastStep = now;
  if (elapsed <= 0) return;
  if (elapsed > AWAY_THRESHOLD_SECONDS) return bookAway(elapsed);
  state = advanceTime(state, elapsed);
  pendingTicks += elapsed;
  while (pendingTicks >= 1) { pendingTicks -= 1; state = simulateTick(state); }
  if (structureKey() !== renderedKey) render(); else renderLiveValues();
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenSince = Date.now(); saveGame(state); return; }
  const away = (Date.now() - hiddenSince) / 1000;
  lastStep = performance.now();
  pendingTicks = 0;
  if (hiddenSince && away > AWAY_THRESHOLD_SECONDS) bookAway(away);
});

render();
const frame = (now: number): void => { step(now); requestAnimationFrame(frame); };
requestAnimationFrame(frame);
setInterval(() => step(), 1000);
setInterval(() => saveGame(state), 5000);
window.addEventListener('beforeunload', () => saveGame(state));
