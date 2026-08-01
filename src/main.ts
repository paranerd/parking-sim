import './styles.scss';
import {
  adjustHourlyPrice,
  advanceTime,
  AWAY_CAP_MINUTES,
  AwayReport,
  buyUpgrade,
  attraction,
  BASE_WILLINGNESS,
  currentLocation,
  demand,
  equipmentFactor,
  fixedCostItems,
  fixedCostPerHour,
  GameState,
  INITIAL_STATE,
  LOCATIONS,
  maintenanceCost,
  paymentRate,
  paymentStage,
  performMaintenance,
  PRICE_STEP,
  profitPerHour,
  reputationFactor,
  repairIncident,
  revenuePerHour,
  runningCostChange,
  simulateAway,
  simulateTick,
  occupancy,
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

const categories: (UpgradeCategory | 'Alle')[] = ['Alle', 'Standort', 'Kapazität', 'Nachfrage', 'Erlös'];

/** Absences shorter than this are booked silently. */
const AWAY_MODAL_MINUTES = 60;

const loaded = loadGame();
let state = loaded.state;
/** Report of the last absence, shown as a modal while it is set. */
let awayReport: AwayReport | null = loaded.away && loaded.away.awayMinutes >= AWAY_MODAL_MINUTES ? loaded.away : null;
let selectedCategory: UpgradeCategory | 'Alle' = 'Alle';
let muted = false;
let askReset = false;
let showProfitModal = false;
let showDemandModal = false;

const money = (value: number): string => `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const signedMoney = (value: number): string => `${value < 0 ? '−' : '+'} ${money(Math.abs(value))}`;
const rate = (game: GameState): string => signedMoney(profitPerHour(game));
const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
const percent = (value: number): string => `${Math.round(value)}%`;
const cars = (value: number): string => value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Cars currently standing on the lot – the continuous occupancy made visible. */
const occupiedSpaces = (game: GameState): number => Math.round(occupancy(game) * game.spaces);

/** The next milestone: fill the lot, then move up to the next location. */
const goal = (game: GameState): { title: string; progress: number; hint: string } => {
  const next = upgrades.find((upgrade) => upgrade.id === 'location');
  const level = game.levels.location;
  if (!next || level >= (next.maxLevel ?? 0)) {
    return { title: 'Flughafen ausbauen', progress: Math.min(100, game.spaces / 1000 * 100), hint: `${game.spaces} von 1.000 Stellplätzen am besten Standort` };
  }
  const cost = upgradeCost(next, level);
  const target = LOCATIONS[level + 1].name;
  return {
    title: `Umzug: ${target}`,
    progress: Math.min(100, game.cash / cost * 100),
    hint: `${money(cost)} für den Umzug – Basis-Nachfrage ${cars(LOCATIONS[level + 1].baseDemand)} statt ${cars(LOCATIONS[level].baseDemand)} Autos`,
  };
};

/** Tells the player whether supply or demand is the current bottleneck. */
const marketHint = (game: GameState): string => {
  const turnedAway = turnedAwayShare(game);
  if (turnedAway > 0.15) return `${percent(turnedAway * 100)} der Gäste finden keinen Platz – du kannst mehr verlangen oder ausbauen`;
  if (turnedAway > 0.02) return `Ausgebucht – ${percent(turnedAway * 100)} finden keinen Platz und bewerten schlechter`;
  if (occupancy(game) < 0.65) return 'Viele Plätze bleiben leer – ein günstigerer Tarif holt mehr Gäste';
  return 'Angebot und Nachfrage sind im Gleichgewicht';
};

/** How long the player was gone, in plain words. */
const duration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${Math.max(1, rest)} Minuten`;
  return rest === 0 ? `${hours} Stunden` : `${hours} Std. ${rest} Min.`;
};

/** What happened while nobody was watching. */
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
    <button data-action="close-away">Weiterbauen</button>
  </div>
</div>`;

/** Revenue, costs and what stays – one line per factor. */
const profitModal = (game: GameState): string => {
  const revenue = revenuePerHour(game);
  const costs = fixedCostPerHour(game);
  const profit = profitPerHour(game);
  return `<div class="modal-backdrop" id="profit-modal">
    <div class="modal wide">
      <span class="eyebrow">BILANZ</span>
      <h2 class="${profit < 0 ? 'negative' : 'positive'}">${signedMoney(profit)} pro Stunde</h2>
      <table class="ledger">
        <tr class="section"><th colspan="2">Umsatz</th></tr>
        <tr><td>Preis pro Stunde</td><td>${money(game.price)}</td></tr>
        <tr><td>Stellplätze</td><td>× ${game.spaces}</td></tr>
        <tr><td>Nachfrage <em>(höchstens 100 %)</em></td><td>× ${percent(occupancy(game) * 100)}</td></tr>
        <tr><td>Zahlungsquote <em>(${paymentStage(game).name})</em></td><td>× ${percent(paymentRate(game) * 100)}</td></tr>
        <tr class="sum"><td>Umsatz pro Stunde</td><td>${money(revenue)}</td></tr>
        <tr class="section"><th colspan="2">Kosten</th></tr>
        ${fixedCostItems(game).map((item) => `<tr><td>${item.label}</td><td>${money(item.amount)}</td></tr>`).join('')}
        <tr class="sum"><td>Kosten pro Stunde</td><td>${money(costs)}</td></tr>
        <tr class="section"><th colspan="2">Gewinn</th></tr>
        <tr class="total"><td>${money(revenue)} Umsatz − ${money(costs)} Kosten <em>(Spielzeit läuft in Echtzeit – eine Stunde ist eine Stunde)</em></td><td class="${profit < 0 ? 'negative' : ''}">${signedMoney(profit)}</td></tr>
      </table>
      <button data-action="close-profit">Verstanden</button>
    </div>
  </div>`;
};

/** Where the demand comes from – one line per factor, same ledger shape. */
const demandModal = (game: GameState): string => {
  const wanted = demand(game);
  const priceFactor = attraction(game) > 0 ? wanted / attraction(game) : 1;
  const share = wanted / Math.max(1, game.spaces) * 100;
  const turnedAway = turnedAwayShare(game);
  return `<div class="modal-backdrop" id="demand-modal">
    <div class="modal wide">
      <span class="eyebrow">NACHFRAGE</span>
      <h2>${cars(wanted)} Autos suchen einen Platz</h2>
      <table class="ledger">
        <tr class="section"><th colspan="2">So viele Gäste kommen zusammen</th></tr>
        <tr><td>Basis-Nachfrage <em>(${currentLocation(game).name})</em></td><td>${cars(currentLocation(game).baseDemand)} Autos</td></tr>
        <tr><td>Bewertung <em>(${game.reputation.toFixed(1)} ★)</em></td><td>× ${percent(reputationFactor(game) * 100)}</td></tr>
        <tr><td>Werbung und Ausstattung</td><td>× ${percent(equipmentFactor(game) * 100)}</td></tr>
        <tr><td>Preis <em>(${money(game.price)} gegen ${money(willingnessToPay(game))} Zahlungsbereitschaft)</em></td><td>× ${percent(priceFactor * 100)}</td></tr>
        <tr class="sum"><td>Autos, die parken wollen</td><td>${cars(wanted)}</td></tr>
        <tr class="section"><th colspan="2">Auf ${game.spaces} ${game.spaces === 1 ? 'Stellplatz' : 'Stellplätzen'}</th></tr>
        <tr class="total"><td>Nachfrage <em>(höchstens 100 %)</em></td><td>${percent(Math.min(100, share))}</td></tr>
      </table>
      <p class="note"><b>Zahlungsbereitschaft:</b> ${money(BASE_WILLINGNESS)} gelten als fairer Stundentarif; der Standort (${currentLocation(game).name} × ${currentLocation(game).willingnessFactor.toLocaleString('de-DE')}) und Ausstattung wie die Überdachung heben ihn an. Genau bei diesem Tarif liegt die Nachfrage bei 100 %, darüber fällt sie überproportional, darunter steigt sie – bis das Einzugsgebiet erschöpft ist.</p>
      <p class="note">${turnedAway > 0.02
        ? `Rechnerisch sind es ${percent(share)} – die überzähligen ${percent(turnedAway * 100)} finden keinen Platz, fahren weiter und bewerten schlechter. Mehr verlangen oder ausbauen.`
        : 'Angebot und Nachfrage sind im Gleichgewicht.'}</p>
      <button data-action="close-demand">Verstanden</button>
    </div>
  </div>`;
};

/** Beyond this the lot is drawn as a sample plus a count. */
const MAX_DRAWN_SPACES = 60;

const parkedCars = (game: GameState): { grid: string; columns: number; hidden: number } => {
  const shown = Math.min(game.spaces, MAX_DRAWN_SPACES);
  const columns = Math.max(5, Math.ceil(Math.sqrt(shown * 2.6)));
  const occupied = Math.round(occupancy(game) * shown);
  const colors = ['blue', 'cream', 'orange', 'green', 'purple'];
  const grid = Array.from({ length: shown }, (_, index) => {
    const taken = index < occupied;
    return `<div class="parking-space ${taken ? 'occupied' : ''}">${shown <= 30 ? `<span>${index + 1}</span>` : ''}${taken ? `<div class="car ${colors[index % colors.length]}"><i></i><b></b></div>` : ''}</div>`;
  }).join('');
  return { grid, columns, hidden: game.spaces - shown };
};

/**
 * Selector of the focused control, but only when it was reached by keyboard.
 * Restoring focus after a mouse click would leave the clicked button looking
 * pressed until the player clicks somewhere else.
 */
const focusedSelector = (): string | null => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !app.contains(element) || !element.matches(':focus-visible')) return null;
  const key = (['priceStep', 'upgrade', 'action', 'filter'] as const).find((name) => element.dataset[name]);
  return key ? `[data-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${element.dataset[key]}"]` : null;
};

/**
 * Everything that changes the markup itself rather than just a number in it.
 * As long as this stays the same, the DOM is left alone and only the live
 * values are written – otherwise a click would land on a node that the next
 * re-render has already replaced, and the browser swallows it.
 */
const structureKey = (): string => [
  state.spaces, state.day, selectedCategory, muted, askReset, showProfitModal, showDemandModal, awayReport !== null,
  state.activeIncident?.id ?? '-', state.price <= 0, occupiedSpaces(state),
  Object.values(state.levels).join(','),
  // Buttons flip between enabled and disabled as the cash passes their price.
  upgrades.map((upgrade) => state.cash >= upgradeCost(upgrade, state.levels[upgrade.id])).join(''),
  state.cash >= maintenanceCost(state), state.condition >= 99,
  state.activeIncident ? state.cash >= state.activeIncident.repairCost : false,
].join('|');

let renderedKey = '';
/** A press in progress freezes the DOM until the pointer is released. */
let pointerHeld = false;
let renderPending = false;

const render = (): void => {
  if (pointerHeld) {
    renderPending = true;
    return;
  }
  renderPending = false;
  renderedKey = structureKey();
  const restoreFocus = focusedSelector();
  const filled = occupancy(state) * 100;
  const loss = profitPerHour(state) < 0;
  const wanted = demand(state);
  const demandShare = wanted / Math.max(1, state.spaces) * 100;
  const filtered = upgrades.filter((upgrade) => selectedCategory === 'Alle' || upgrade.category === selectedCategory);
  const nextGoal = goal(state);
  const lot = parkedCars(state);

  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="Parking Empire Startseite"><span class="brand-mark">P</span><strong>Parking<br><em>Empire</em></strong></a>
      <div class="header-stats">
        <button class="cash-stat" data-action="explain-profit" aria-haspopup="dialog" title="Wie kommt der Gewinn zustande?">
          <span>KONTOSTAND</span>
          <strong data-live="cash">${money(state.cash)}</strong>
          <small class="${loss ? 'negative' : 'positive'}" data-live="rate-line"><b data-live="rate">${rate(state)}</b> / Std. <i>ⓘ</i></small>
        </button>
        <div><span>AUSLASTUNG</span><strong data-live="occupancy">${percent(filled)}</strong></div>
        <div><span>NACHFRAGE</span><strong data-live="demand">${percent(demandShare)}</strong></div>
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
            <div><span class="eyebrow">DEIN STANDORT</span><h1>${currentLocation(state).address}</h1><p>${currentLocation(state).name} · ${state.spaces} ${state.spaces === 1 ? 'Stellplatz' : 'Stellplätze'}</p></div>
            <div class="weather"><span>☀</span><div><strong data-live="clock">${clock(state.minuteOfDay)}</strong><small>Sonnig · 22°C</small></div></div>
          </div>
          <div class="parking-scene">
            <div class="city city-left"></div><div class="city city-right"></div>
            <div class="road road-top"><span>BUS</span><i></i><i></i></div>
            <div class="lot">
              <div class="lot-sign"><b>P</b><span>PARKEN<br>FREI</span></div>
              <div class="spaces" style="grid-template-columns: repeat(${lot.columns}, 1fr)">${lot.grid}</div>
              ${lot.hidden > 0 ? `<div class="lot-more">+ ${lot.hidden} weitere Plätze</div>` : ''}
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
          <div class="metric"><div><span>Auslastung</span><strong data-live="occupancy">${percent(filled)}</strong></div><div class="progress"><i data-live="occupancy-bar" style="width:${filled}%"></i></div><small><b data-live="capacity">${cars(occupancy(state) * state.spaces)}</b> von ${state.spaces} ${state.spaces === 1 ? 'Platz' : 'Plätzen'} belegt</small></div>
          <div class="metric"><div><span>Nachfrage <button class="info-button" data-action="explain-demand" aria-haspopup="dialog" aria-label="Wie entsteht die Nachfrage?">i</button></span><strong data-live="demand">${percent(demandShare)}</strong></div><div class="progress ${demandShare > 100 ? 'amber' : ''}"><i data-live="demand-bar" style="width:${Math.min(100, demandShare)}%"></i></div><small><b data-live="demand-cars">${cars(wanted)}</b> Autos suchen einen Platz</small></div>
          <div class="market-hint ${turnedAwayShare(state) > 0.02 ? 'tight' : ''}" data-live="market-hint">${marketHint(state)}</div>
          <div class="price-setting">
            <div class="price-head"><span id="price-label">PREIS / STD.</span><small>Gewinn <b class="${loss ? 'negative' : 'positive'}" data-live="rate">${rate(state)}</b> / Std.</small></div>
            <div class="price-stepper" role="group" aria-labelledby="price-label">
              <button type="button" class="coarse" data-price-step="-10" aria-label="Preis um ${money(PRICE_STEP * 10)} senken" ${state.price <= 0 ? 'disabled' : ''}>− ${money(PRICE_STEP * 10)}</button>
              <button type="button" data-price-step="-1" aria-label="Preis um ${money(PRICE_STEP)} senken" ${state.price <= 0 ? 'disabled' : ''}>−</button>
              <strong aria-live="polite" data-live="price">${money(state.price)}</strong>
              <button type="button" data-price-step="1" aria-label="Preis um ${money(PRICE_STEP)} erhöhen">+</button>
              <button type="button" class="coarse" data-price-step="10" aria-label="Preis um ${money(PRICE_STEP * 10)} erhöhen">+ ${money(PRICE_STEP * 10)}</button>
            </div>
            <small class="price-hint">Gedrückt halten ändert den Preis fortlaufend</small>
          </div>
          <div class="quick-stats">
            <div><span>BEWERTUNG</span><strong><b data-live="reputation">${state.reputation.toFixed(1)}</b> <em>★</em></strong><small><span data-live="reviews">${Math.max(4, Math.floor(state.carsServed) + 14)}</span> Rezensionen</small></div>
            <div><span>ZAHLUNGSBEREITSCHAFT</span><strong>${money(willingnessToPay(state))}</strong><small>Referenztarif – darüber sinkt die Nachfrage</small></div>
            <div><span>ZAHLUNGSQUOTE</span><strong>${percent(paymentRate(state) * 100)}</strong><small>${paymentStage(state).name}</small></div>
          </div>
          <div class="condition">
            <div><span>Anlagenzustand</span><strong data-live="condition">${percent(state.condition)}</strong></div>
            <div class="progress amber"><i data-live="condition-bar" style="width:${state.condition}%"></i></div>
            <button class="text-button" data-action="maintenance" ${state.cash < maintenanceCost(state) || state.condition >= 99 ? 'disabled' : ''}>Wartung durchführen · <span data-live="maintenance">${money(maintenanceCost(state))}</span></button>
          </div>
          ${state.activeIncident ? `<div class="incident"><div class="incident-icon">!</div><div><strong>${state.activeIncident.title}</strong><p>${state.activeIncident.description}</p><button data-action="repair" ${state.cash < state.activeIncident.repairCost ? 'disabled' : ''}>Jetzt reparieren · ${money(state.activeIncident.repairCost)}</button></div></div>` : `<div class="all-good"><span>✓</span><div><strong>Alles läuft rund</strong><small>Keine offenen Störungen</small></div></div>`}
          <div class="quick-stats bottom">
            <div><span>FIXKOSTEN / STD.</span><strong>− ${money(fixedCostPerHour(state))}</strong><small>Miete, Fläche, Personal</small></div>
            <div><span>GEWINN / STD.</span><strong class="${loss ? 'negative' : 'positive'}" data-live="hourly">${signedMoney(profitPerHour(state))}</strong><small><button class="text-button" data-action="explain-profit">Wie kommt das zustande?</button></small></div>
          </div>
          <div class="next-goal"><span>NÄCHSTES ZIEL</span><div><strong>${nextGoal.title}</strong><b data-live="goal">${Math.round(nextGoal.progress)}%</b></div><div class="progress dark"><i data-live="goal-bar" style="width:${nextGoal.progress}%"></i></div><small>${nextGoal.hint}</small></div>
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
            const running = complete ? 0 : runningCostChange(state, upgrade.id);
            const runningNote = Math.abs(running) < 0.005 ? '' : `<em class="${running > 0 ? 'cost' : 'positive'}">${running > 0 ? '+' : '−'} ${money(Math.abs(running))} Fixkosten / Std.</em>`;
            return `<article class="upgrade-card ${state.cash >= cost && !complete ? 'affordable' : ''}">
              <div class="upgrade-icon">${upgrade.icon}</div>
              <div class="upgrade-copy"><span>${upgrade.category.toUpperCase()}</span><h3>${upgrade.name}</h3><p>${upgrade.description}${stage}${runningNote}</p><div class="level-dots">${Array.from({ length: displayedLevels }, (_, index) => `<i class="${upgrade.maxLevel === null ? 'filled endless' : index < level ? 'filled' : ''}"></i>`).join('')}<small>STUFE ${level}${upgrade.maxLevel === null ? ' · ∞' : `/${upgrade.maxLevel}`}</small></div></div>
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
    ${awayReport ? awayModal(awayReport) : ''}
    ${showProfitModal ? profitModal(state) : ''}
    ${showDemandModal ? demandModal(state) : ''}
    ${askReset ? `<div class="modal-backdrop" id="reset-modal"><div class="modal"><span class="modal-icon warn">↻</span><span class="eyebrow">NEU STARTEN</span><h2>Wirklich von vorn beginnen?</h2><p>Dein Spielstand von Tag ${state.day} mit ${state.spaces} ${state.spaces === 1 ? 'Stellplatz' : 'Stellplätzen'} und ${money(state.cash)} wird endgültig gelöscht.</p><div class="modal-actions"><button class="ghost" data-action="cancel-reset">Abbrechen</button><button data-action="confirm-reset">Ja, neu starten</button></div></div></div>` : ''}
  `;

  if (restoreFocus) app.querySelector<HTMLElement>(restoreFocus)?.focus();
};

/**
 * Holding a price button keeps changing the price and speeds up, so a few euros
 * are one long press instead of forty clicks. The click handler still does a
 * single step, which keeps the buttons usable from the keyboard.
 */
let holdTimer: number | undefined;
let repeated = false;

const stopHold = (): void => {
  window.clearTimeout(holdTimer);
  holdTimer = undefined;
};

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
  pointerHeld = true;
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-price-step]');
  if (button && !(button as HTMLButtonElement).disabled) startHold(Number(button.dataset.priceStep));
});

const releasePointer = (): void => {
  stopHold();
  pointerHeld = false;
  if (renderPending) render();
};
document.addEventListener('pointerup', releasePointer);
document.addEventListener('pointercancel', releasePointer);
window.addEventListener('blur', releasePointer);

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a');
  if (!target) return;
  if (target.matches('a')) event.preventDefault();
  const filter = target.dataset.filter as typeof selectedCategory | undefined;
  const upgrade = target.dataset.upgrade as UpgradeId | undefined;
  const priceStep = target.dataset.priceStep;
  if (filter) selectedCategory = filter;
  if (upgrade) state = buyUpgrade(state, upgrade);
  // A click after a hold would add one step on top of the repeats.
  if (priceStep && !repeated) state = adjustHourlyPrice(state, Number(priceStep));
  repeated = false;
  if (target.dataset.action === 'repair') state = repairIncident(state);
  if (target.dataset.action === 'maintenance') state = performMaintenance(state);
  if (target.dataset.action === 'mute') muted = !muted;
  if (target.dataset.action === 'close-away') awayReport = null;
  if (target.dataset.action === 'explain-profit') showProfitModal = true;
  if (target.dataset.action === 'close-profit') showProfitModal = false;
  if (target.dataset.action === 'explain-demand') showDemandModal = true;
  if (target.dataset.action === 'close-demand') showDemandModal = false;
  if (target.dataset.action === 'ask-reset') askReset = true;
  if (target.dataset.action === 'cancel-reset') askReset = false;
  if (target.dataset.action === 'confirm-reset') restartGame();
  render();
});

/** Wipes the save and starts a brand new parking lot without a page reload. */
const restartGame = (): void => {
  resetGame();
  state = { ...structuredClone(INITIAL_STATE), lastSavedAt: Date.now() };
  selectedCategory = 'Alle';
  askReset = false;
  awayReport = null;
  showProfitModal = false;
  showDemandModal = false;
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
  setLive('rate', rate(state));
  setLive('hourly', signedMoney(profitPerHour(state)));
  setLive('reputation', state.reputation.toFixed(1));

  // A lot can slip into the red between two ticks, so the colour follows live.
  const loss = profitPerHour(state) < 0;
  app.querySelectorAll<HTMLElement>('[data-live="rate-line"], [data-live="hourly"]').forEach((node) => {
    node.classList.toggle('negative', loss);
    node.classList.toggle('positive', !loss);
  });

  const filled = occupancy(state) * 100;
  setLive('occupancy', percent(filled));
  setLive('capacity', cars(occupancy(state) * state.spaces));
  const occupancyBar = app.querySelector<HTMLElement>('[data-live="occupancy-bar"]');
  if (occupancyBar) occupancyBar.style.width = `${filled}%`;

  const wanted = demand(state);
  const demandShare = wanted / Math.max(1, state.spaces) * 100;
  setLive('demand', percent(demandShare));
  setLive('demand-cars', cars(wanted));
  const demandBar = app.querySelector<HTMLElement>('[data-live="demand-bar"]');
  if (demandBar) {
    demandBar.style.width = `${Math.min(100, demandShare)}%`;
    demandBar.parentElement?.classList.toggle('amber', demandShare > 100);
  }

  setLive('price', money(state.price));
  setLive('maintenance', money(maintenanceCost(state)));
  setLive('reviews', String(Math.max(4, Math.floor(state.carsServed) + 14)));
  setLive('condition', percent(state.condition));
  const conditionBar = app.querySelector<HTMLElement>('[data-live="condition-bar"]');
  if (conditionBar) conditionBar.style.width = `${state.condition}%`;

  const nextGoal = goal(state);
  setLive('goal', `${Math.round(nextGoal.progress)}%`);
  const goalBar = app.querySelector<HTMLElement>('[data-live="goal-bar"]');
  if (goalBar) goalBar.style.width = `${nextGoal.progress}%`;

  const hint = app.querySelector<HTMLElement>('[data-live="market-hint"]');
  if (hint) {
    hint.textContent = marketHint(state);
    hint.classList.toggle('tight', turnedAwayShare(state) > 0.02);
  }
};

let lastStep = performance.now();
let pendingTicks = 0;
let hiddenSince = 0;

/** Gaps longer than this are booked as an absence instead of simulated live. */
const AWAY_THRESHOLD_SECONDS = 45;

/** Books an absence and offers the report if it was a long one. */
const bookAway = (seconds: number): void => {
  const report = simulateAway(state, seconds / 60);
  state = report.state;
  if (report.awayMinutes >= AWAY_MODAL_MINUTES) awayReport = report;
  saveGame(state);
  render();
};

/** Books the elapsed real time; income accrues per frame, events once per second. */
const step = (now = performance.now()): void => {
  // While the tab is hidden the browser throttles everything; that time is
  // settled in one go when the player comes back.
  if (document.hidden) return;
  const elapsed = Math.max(0, (now - lastStep) / 1000);
  lastStep = now;
  if (elapsed <= 0) return;
  if (elapsed > AWAY_THRESHOLD_SECONDS) return bookAway(elapsed);

  state = advanceTime(state, elapsed);
  pendingTicks += elapsed;
  while (pendingTicks >= 1) {
    pendingTicks -= 1;
    state = simulateTick(state);
  }

  // Rebuild the DOM only when the markup really changes; the rest is written
  // into the existing nodes.
  if (structureKey() !== renderedKey) render();
  else renderLiveValues();
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenSince = Date.now();
    saveGame(state);
    return;
  }
  const away = (Date.now() - hiddenSince) / 1000;
  lastStep = performance.now();
  pendingTicks = 0;
  if (hiddenSince && away > AWAY_THRESHOLD_SECONDS) bookAway(away);
});

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
