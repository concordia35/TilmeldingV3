const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw5kZ4Yjgge_sKnxhSjjVLkb8cI-hG0E_qcScyxP7820a7lzfCr42HhZDp3lW2kmNsy/exec",
  LODGE_NAME: "Broderloge nr. 35 Concordia"
};

const state = {
  events: [],
  members: [],
  rows: [],
  signups: {},
  currentEvent: null,
  currentChoice: {},
  deferredInstallPrompt: null
};

const els = {
  memberSelect: document.getElementById('memberSelect'),
  saveMemberBtn: document.getElementById('saveMemberBtn'),
  syncStatus: document.getElementById('syncStatus'),
  installBtn: document.getElementById('installBtn'),
  eventsList: document.getElementById('eventsList'),
  totalEvents: document.getElementById('totalEvents'),
  myAttending: document.getElementById('myAttending'),
  myMeals: document.getElementById('myMeals'),

  modalBackdrop: document.getElementById('modalBackdrop'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalDate: document.getElementById('modalDate'),
  modalTitle: document.getElementById('modalTitle'),
  modalDescription: document.getElementById('modalDescription'),
  mealBlock: document.getElementById('mealBlock'),
  guestBlock: document.getElementById('guestBlock'),
  guestYes: document.getElementById('guestYes'),
  guestDetails: document.getElementById('guestDetails'),
  guestName: document.getElementById('guestName'),
  guestMeal: document.getElementById('guestMeal'),
  noteInput: document.getElementById('noteInput'),
  saveSignupBtn: document.getElementById('saveSignupBtn'),
  saveStatus: document.getElementById('saveStatus'),

  kitchenBtn: document.getElementById('kitchenBtn'),
  kitchenBackdrop: document.getElementById('kitchenBackdrop'),
  closeKitchenBtn: document.getElementById('closeKitchenBtn'),
  kitchenOverview: document.getElementById('kitchenOverview')
};

const storage = {
  get member() {
    try {
      return JSON.parse(localStorage.getItem('concordia_member_v3') || 'null');
    } catch {
      return null;
    }
  },
  set member(v) {
    localStorage.setItem('concordia_member_v3', JSON.stringify(v));
  }
};

const dateFmt = new Intl.DateTimeFormat('da-DK', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const shortMonthFmt = new Intl.DateTimeFormat('da-DK', { month: 'short' });

init();

async function init() {
  localStorage.removeItem('concordia_signups_v3');
  state.signups = {};
  state.events = [];
  bind();
  setupInstall();
  registerSW();
  await refreshFromSheet();
  renderMembers();
  render();
}

function bind() {
  els.saveMemberBtn.addEventListener('click', saveMember);
  els.memberSelect.addEventListener('change', saveMember);

  els.closeModalBtn.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', e => {
    if (e.target === els.modalBackdrop) closeModal();
  });

  document.querySelectorAll('[data-attending]').forEach(b =>
    b.addEventListener('click', () => chooseAttending(b.dataset.attending))
  );

  document.querySelectorAll('[data-meal]').forEach(b =>
    b.addEventListener('click', () => chooseMeal(b.dataset.meal))
  );

  els.guestYes.addEventListener('change', syncGuest);
  els.saveSignupBtn.addEventListener('click', saveSignup);

  els.kitchenBtn.addEventListener('click', openKitchen);
  els.closeKitchenBtn.addEventListener('click', () => els.kitchenBackdrop.hidden = true);
  els.kitchenBackdrop.addEventListener('click', e => {
    if (e.target === els.kitchenBackdrop) els.kitchenBackdrop.hidden = true;
  });

  els.installBtn.addEventListener('click', installApp);
}

async function refreshFromSheet() {
  if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) {
    state.members = fallbackMembers();
    state.events = [];
    els.syncStatus.textContent = 'Ikke koblet på Google Sheet endnu. Arrangementer hentes kun fra Google Sheet.';
    return;
  }

  try {
    els.syncStatus.textContent = 'Henter fra Google Sheet…';

    const res = await fetch(`${CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=list&t=${Date.now()}`, {
      cache: 'no-store'
    });

    const data = await res.json();

    state.members = normalizeMembers(data.members);
    state.rows = normalizeRows(data.rows || data.signups || []);

    state.events = getUpcomingEvents(normalizeEvents(data.events || []));

    mergeCurrentUserRows();

    els.syncStatus.textContent = 'Koblet på Google Sheet.';
  } catch (err) {
    console.warn(err);
    state.members = fallbackMembers();
    state.rows = [];
    state.signups = {};
    state.events = [];
    els.syncStatus.textContent = 'Kunne ikke hente fra Google Sheet.';
  }
}

function normalizeMembers(input) {
  if (!Array.isArray(input) || !input.length) return fallbackMembers();

  if (Array.isArray(input[0])) {
    const rows = input;
    const header = rows[0].map(h => String(h).trim().toLowerCase());

    const idIndex = header.indexOf('id');
    const nameIndex = header.indexOf('navn') !== -1 ? header.indexOf('navn') : header.indexOf('name');

    return rows.slice(1)
      .filter(r => r[idIndex] && r[nameIndex])
      .map(r => ({
        id: String(r[idIndex]).trim(),
        name: String(r[nameIndex]).trim()
      }));
  }

  return input
    .filter(m => m.id && (m.name || m.navn))
    .map(m => ({
      id: String(m.id).trim(),
      name: String(m.name || m.navn).trim()
    }));
}

function normalizeEvents(input) {
  if (!Array.isArray(input) || !input.length) return [];

  if (Array.isArray(input[0])) {
    const rows = input;
    const header = rows[0].map(h => normalizeKey(h));
    const getIndex = names => header.findIndex(h => names.map(normalizeKey).includes(h));

    const idIndex = getIndex(['id', 'eventId']);
    const dateIndex = getIndex(['dato', 'date']);
    const timeIndex = getIndex(['tid', 'time']);
    const titleIndex = getIndex(['titel', 'title']);
    const descIndex = getIndex(['beskrivelse', 'description']);
    const categoryIndex = getIndex(['kategori', 'category', 'type']);
    const guestsIndex = getIndex(['allowGuests', 'gæster tilladt', 'gaester tilladt']);
    const deadlineIndex = getIndex(['deadline', 'frist', 'tilmeldingsfrist']);

    return rows.slice(1).map(r => normalizeEvent({
      id: idIndex === -1 ? '' : r[idIndex],
      date: dateIndex === -1 ? '' : r[dateIndex],
      time: timeIndex === -1 ? '' : r[timeIndex],
      title: titleIndex === -1 ? '' : r[titleIndex],
      description: descIndex === -1 ? '' : r[descIndex],
      category: categoryIndex === -1 ? '' : r[categoryIndex],
      allowGuests: guestsIndex === -1 ? false : r[guestsIndex],
      deadline: deadlineIndex === -1 ? '' : r[deadlineIndex]
    })).filter(e => e.id && e.date);
  }

  return input.map(normalizeEvent).filter(e => e.id && e.date);
}

function normalizeEvent(e) {
  const date = normalizeDate(e.date || e.dato || e.id || '');
  const id = normalizeDate(e.id || e.eventId || date);
  const time = normalizeTime(e.time || e.tid || '19:30');

  return {
    id,
    date,
    time,
    title: String(e.title || e.titel || '').trim() || 'Logeaften',
    category: String(e.category || e.kategori || e.type || '').trim(),
    description: String(e.description || e.beskrivelse || '').trim(),
    allowGuests: isYes(e.allowGuests ?? e.gæsterTilladt ?? e.gaesterTilladt),
    deadline: normalizeDeadline(e.deadline || e.frist || e.tilmeldingsfrist || '', date)
  };
}

function normalizeRows(input) {
  if (!Array.isArray(input) || !input.length) return [];

  if (Array.isArray(input[0])) {
    const rows = input;
    const header = rows[0].map(h => String(h).trim());

    return rows.slice(1)
      .filter(r => r.length)
      .map(r => {
        const obj = {};
        header.forEach((h, i) => obj[h] = r[i]);
        return normalizeRow(obj);
      });
  }

  return input.map(normalizeRow);
}

function renderMembers() {
  const current = storage.member;

  els.memberSelect.innerHTML =
    '<option value="">Vælg navn</option>' +
    state.members
      .map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`)
      .join('');

  if (current) els.memberSelect.value = current.id;
}

function saveMember() {
  const id = els.memberSelect.value;
  const member = state.members.find(m => String(m.id) === String(id));

  if (!member) return;

  storage.member = {
    id: String(member.id),
    name: member.name
  };

  state.signups = {};
  mergeCurrentUserRows();
  render();
}

function mergeCurrentUserRows() {
  const member = storage.member;

  state.signups = {};

  if (!member || !state.rows.length) return;

  const latest = getLatestRows(state.rows);

  Object.values(latest).forEach(row => {
    if (String(row.memberId) === String(member.id)) {
      state.signups[row.eventId] = normalizeRow(row);
    }
  });
}

function render() {
  const member = storage.member;

  els.totalEvents.textContent = state.events.length;
  els.myAttending.textContent = Object.values(state.signups).filter(s => s.attending === 'yes' && hasUpcomingEvent(s.eventId)).length;
  els.myMeals.textContent = Object.values(state.signups).filter(s => s.attending === 'yes' && s.meal === 'yes' && hasUpcomingEvent(s.eventId)).length;

  if (!state.events.length) {
    els.eventsList.innerHTML = '<div class="empty">Der er ingen kommende aftener.</div>';
  } else {
    els.eventsList.innerHTML = state.events.map(event => {
      const signup = state.signups[event.id];
      const status = getStatus(signup, event);
      const summary = getSummary(event.id);
      const d = new Date(`${event.date}T12:00:00`);
      const locked = isDeadlinePassed(event);
      const deadlineLabel = getDeadlineLabel(event);

      return `
        <article class="event-card ${locked ? 'event-locked' : ''}" tabindex="0" role="button" data-event-id="${esc(event.id)}">
          <div class="date-badge">
            <span class="day">${d.getDate()}</span>
            <span class="month">${shortMonthFmt.format(d).replace('.', '')}</span>
          </div>

          <div>
            <h3>${esc(event.title)}</h3>
            <p class="event-meta">${cap(dateFmt.format(d))} · kl. ${event.time.replace(':', '.')} ${event.category ? `· ${esc(event.category)}` : ''}</p>
            ${event.description ? `<p class="event-description">${esc(event.description)}</p>` : ''}
            <p class="event-counts">
              Deltagere: ${summary.attending} · Spiser: ${summary.meals}${summary.guestMeals ? ` · Gæster spiser: ${summary.guestMeals}` : ''}
            </p>
            ${deadlineLabel ? `<p class="deadline-text ${locked ? 'deadline-locked' : ''}">${deadlineLabel}</p>` : ''}
          </div>

          <span class="status-pill ${status.className}">${status.label}</span>
        </article>
      `;
    }).join('');
  }

  els.eventsList.querySelectorAll('.event-card').forEach(c => {
    c.addEventListener('click', () => openModal(c.dataset.eventId));
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openModal(c.dataset.eventId);
    });
  });

  if (!member) {
    els.syncStatus.textContent = CONFIG.GOOGLE_APPS_SCRIPT_URL
      ? 'Vælg dit navn for at starte.'
      : els.syncStatus.textContent;
  }
}

function openModal(eventId) {
  const member = storage.member;

  if (!member) {
    els.memberSelect.focus();
    return;
  }

  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  const existing = state.signups[eventId] || {};
  const locked = isDeadlinePassed(event);

  state.currentEvent = event;
  state.currentChoice = {
    attending: existing.attending || null,
    meal: existing.meal || null,
    guest: existing.guest === 'yes',
    guestName: existing.guestName || '',
    guestMeal: existing.guestMeal === 'yes',
    note: existing.note || '',
    locked
  };

  const d = new Date(`${event.date}T12:00:00`);

  els.modalDate.textContent = `${cap(dateFmt.format(d))} · kl. ${event.time.replace(':', '.')}`;
  els.modalTitle.textContent = event.title;
  els.modalDescription.textContent = locked
    ? 'Tilmeldingsfristen er overskredet. Du kan se din nuværende status, men ændringer skal gå via restauratøren.'
    : (event.description || 'Vælg din tilmelding.');

  els.guestBlock.hidden = !event.allowGuests;
  els.noteInput.value = state.currentChoice.note;
  els.saveStatus.textContent = locked ? 'Fristen er overskredet. Kontakt restauratøren ved ændringer.' : '';

  syncChoices();
  setModalDisabled(locked);
  els.modalBackdrop.hidden = false;
}

function closeModal() {
  els.modalBackdrop.hidden = true;
  setModalDisabled(false);
  state.currentEvent = null;
}

function chooseAttending(v) {
  if (state.currentChoice.locked) return;
  state.currentChoice.attending = v;

  if (v === 'no') {
    state.currentChoice.meal = 'no';
    state.currentChoice.guest = false;
    state.currentChoice.guestName = '';
    state.currentChoice.guestMeal = false;
  }

  syncChoices();
}

function chooseMeal(v) {
  if (state.currentChoice.locked) return;
  if (state.currentChoice.attending !== 'yes') return;

  state.currentChoice.meal = v;
  syncChoices();
}

function syncGuest() {
  if (state.currentChoice.locked) return;
  state.currentChoice.guest = els.guestYes.checked;

  if (!state.currentChoice.guest) {
    state.currentChoice.guestName = '';
    state.currentChoice.guestMeal = false;
  }

  syncChoices();
}

function syncChoices() {
  document.querySelectorAll('[data-attending]').forEach(b =>
    b.classList.toggle('active', b.dataset.attending === state.currentChoice.attending)
  );

  document.querySelectorAll('[data-meal]').forEach(b => {
    b.classList.toggle('active', b.dataset.meal === state.currentChoice.meal);
    b.disabled = state.currentChoice.attending !== 'yes' || state.currentChoice.locked;
  });

  els.mealBlock.style.opacity = state.currentChoice.attending === 'yes' ? '1' : '.55';

  els.guestYes.checked = !!state.currentChoice.guest;
  els.guestYes.disabled = state.currentChoice.attending !== 'yes' || state.currentChoice.locked;

  els.guestDetails.hidden = !state.currentChoice.guest || state.currentChoice.attending !== 'yes';
  els.guestName.value = state.currentChoice.guestName || '';
  els.guestMeal.checked = !!state.currentChoice.guestMeal;
}

function setModalDisabled(disabled) {
  document.querySelectorAll('[data-attending]').forEach(b => b.disabled = disabled);
  document.querySelectorAll('[data-meal]').forEach(b => b.disabled = disabled || state.currentChoice.attending !== 'yes');
  els.guestYes.disabled = disabled || state.currentChoice.attending !== 'yes';
  els.guestName.disabled = disabled;
  els.guestMeal.disabled = disabled;
  els.noteInput.disabled = disabled;
  els.saveSignupBtn.disabled = disabled;
  els.saveSignupBtn.textContent = disabled ? 'Frist overskredet' : 'Gem';
}

async function saveSignup() {
  const member = storage.member;

  if (!member || !state.currentEvent) return;

  if (isDeadlinePassed(state.currentEvent)) {
    els.saveStatus.textContent = 'Tilmeldingsfristen er overskredet. Kontakt restauratøren ved ændringer.';
    setModalDisabled(true);
    return;
  }

  if (!state.currentChoice.attending) {
    els.saveStatus.textContent = 'Vælg om du deltager eller ej.';
    return;
  }

  if (state.currentChoice.attending === 'yes' && !state.currentChoice.meal) {
    els.saveStatus.textContent = 'Vælg om du spiser med eller ej.';
    return;
  }

  const signup = {
    memberId: member.id,
    name: member.name,
    navn: member.name,

    eventId: state.currentEvent.id,
    eventDate: state.currentEvent.date,
    eventTime: state.currentEvent.time,
    eventTitle: state.currentEvent.title,

    attending: state.currentChoice.attending,
    deltager: state.currentChoice.attending,

    meal: state.currentChoice.attending === 'yes' ? state.currentChoice.meal : 'no',
    mad: state.currentChoice.attending === 'yes' ? state.currentChoice.meal : 'no',

    guest: state.currentChoice.attending === 'yes' && els.guestYes.checked ? 'yes' : 'no',
    guestName: state.currentChoice.attending === 'yes' && els.guestYes.checked ? els.guestName.value.trim() : '',
    guestFood: state.currentChoice.attending === 'yes' && els.guestYes.checked && els.guestMeal.checked ? 'yes' : 'no',
    guestMeal: state.currentChoice.attending === 'yes' && els.guestYes.checked && els.guestMeal.checked ? 'yes' : 'no',

    note: els.noteInput.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (CONFIG.GOOGLE_APPS_SCRIPT_URL) {
    try {
      els.saveStatus.textContent = 'Gemmer…';
      els.saveSignupBtn.disabled = true;

      const res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(signup)
      });

      const data = await res.json();

      if (!(data.ok || data.success)) {
        throw new Error(data.error || 'Ukendt fejl');
      }

      els.saveStatus.textContent = 'Gemt i Google Sheet.';

      await refreshFromSheet();
      render();

      setTimeout(() => {
        closeModal();
      }, 650);
    } catch (err) {
      console.warn(err);
      els.saveSignupBtn.disabled = false;
      els.saveStatus.textContent = 'Kunne ikke gemme i Google Sheet.';
    }
  } else {
    els.saveStatus.textContent = 'Google Sheet er ikke koblet på.';
  }
}

function openKitchen() {
  const latest = getLatestRows(state.rows);
  const byEvent = {};

  Object.values(latest).forEach(r => {
    if (r.attending !== 'yes') return;
    if (!hasUpcomingEvent(r.eventId)) return;
    (byEvent[r.eventId] ||= []).push(r);
  });

  els.kitchenOverview.innerHTML = state.events.map(event => {
    const rows = (byEvent[event.id] || []).sort((a, b) => a.name.localeCompare(b.name, 'da'));
    const meals = rows.filter(r => r.meal === 'yes').length;
    const guests = rows.filter(r => r.guest === 'yes').length;
    const guestMeals = rows.filter(r => r.guestMeal === 'yes').length;
    const d = new Date(`${event.date}T12:00:00`);

    return `
      <div class="kitchen-event">
        <h3>${esc(event.title)}</h3>
        <p class="event-meta">${cap(dateFmt.format(d))} · kl. ${event.time.replace(':', '.')}</p>

        <div class="kitchen-stats">
          <span>Deltagere: ${rows.length}</span>
          <span>Brødre spiser: ${meals}</span>
          <span>Gæster: ${guests}</span>
          <span>Gæster spiser: ${guestMeals}</span>
          <span>Kuverter i alt: ${meals + guestMeals}</span>
        </div>

        ${
          rows.length
            ? `<ol class="name-list">${rows.map(r => `
                <li>
                  ${esc(r.name)}
                  ${r.meal === 'yes' ? ' · mad' : ''}
                  ${r.guest === 'yes' ? ` · gæst: ${esc(r.guestName || 'uden navn')}${r.guestMeal === 'yes' ? ' (spiser)' : ''}` : ''}
                </li>
              `).join('')}</ol>`
            : '<p class="muted">Ingen tilmeldte endnu.</p>'
        }
      </div>
    `;
  }).join('') || '<div class="empty">Ingen kommende aftener.</div>';

  els.kitchenBackdrop.hidden = false;
}

function getSummary(eventId) {
  const latest = getLatestRows(state.rows);

  const rows = Object.values(latest)
    .filter(r => r.eventId === eventId && r.attending === 'yes');

  return {
    attending: rows.length,
    meals: rows.filter(r => r.meal === 'yes').length,
    guestMeals: rows.filter(r => r.guestMeal === 'yes').length
  };
}

function getLatestRows(rows) {
  const latest = {};

  rows.forEach(r => {
    if (!r || !r.eventId) return;

    const key = `${r.eventId}__${r.memberId || norm(r.name)}`;

    if (!latest[key] || new Date(r.updatedAt || 0) >= new Date(latest[key].updatedAt || 0)) {
      latest[key] = r;
    }
  });

  return latest;
}

function normalizeRow(r) {
  return {
    memberId: String(r.memberId || '').trim(),
    name: String(r.name || r.navn || '').trim(),

    eventId: normalizeDate(r.eventId || ''),
    eventDate: normalizeDate(r.eventDate || ''),
    eventTime: r.eventTime || '',
    eventTitle: r.eventTitle || '',

    attending: yn(r.attending || r.deltager),
    meal: yn(r.meal || r.mad),
    guest: yn(r.guest),
    guestName: r.guestName || '',
    guestMeal: yn(r.guestMeal || r.guestFood),
    note: r.note || '',

    updatedAt: r.updatedAt || r.timestamp || new Date().toISOString()
  };
}

function getStatus(s, event) {
  const locked = event ? isDeadlinePassed(event) : false;

  if (!s) {
    return locked
      ? { label: 'Frist overskredet', className: 'status-no' }
      : { label: 'Ikke valgt', className: 'status-none' };
  }

  if (s.attending === 'no') {
    return { label: locked ? 'Deltager ikke · låst' : 'Deltager ikke', className: 'status-no' };
  }

  if (s.attending === 'yes' && s.meal === 'yes') {
    return {
      label: s.guest === 'yes'
        ? (locked ? 'Deltager + mad + gæst · låst' : 'Deltager + mad + gæst')
        : (locked ? 'Deltager + mad · låst' : 'Deltager + mad'),
      className: 'status-yes'
    };
  }

  if (s.attending === 'yes') {
    return {
      label: s.guest === 'yes'
        ? (locked ? 'Deltager uden mad + gæst · låst' : 'Deltager uden mad + gæst')
        : (locked ? 'Deltager uden mad · låst' : 'Deltager uden mad'),
      className: 'status-meal-no'
    };
  }

  return { label: 'Ikke valgt', className: 'status-none' };
}

function getUpcomingEvents(events) {
  return events
    .filter(e => !isPast(e.date))
    .sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
}

function hasUpcomingEvent(eventId) {
  return state.events.some(e => e.id === eventId);
}

function isPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Date(`${normalizeDate(date)}T23:59:59`) < today;
}

function isDeadlinePassed(event) {
  const deadline = getDeadlineDate(event);
  if (!deadline) return false;
  return new Date() > deadline;
}

function getDeadlineDate(event) {
  if (!event || !event.deadline) return null;
  const raw = String(event.deadline).trim();
  if (!raw) return null;

  let normalized = raw.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T23:59:00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) normalized += ':00';

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function getDeadlineLabel(event) {
  const deadline = getDeadlineDate(event);
  if (!deadline) return '';

  const date = deadline.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = deadline.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

  return isDeadlinePassed(event)
    ? `Tilmeldingsfrist overskredet ${date} kl. ${time}`
    : `Tilmeld senest ${date} kl. ${time}`;
}

function normalizeDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();

  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];

  const dk = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dk) return `${dk[3]}-${String(dk[2]).padStart(2, '0')}-${String(dk[1]).padStart(2, '0')}`;

  const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const textDate = s.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/);
  if (textDate) return `${textDate[3]}-${monthMap[textDate[1]]}-${String(textDate[2]).padStart(2, '0')}`;

  return s;
}

function normalizeDeadline(v, fallbackDate) {
  if (!v) return '';
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}`;
  }

  const s = String(v || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59`;
  if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}\s+\d{1,2}:\d{2}$/.test(s)) {
    const [datePart, timePart] = s.split(/\s+/);
    return `${normalizeDate(datePart)}T${normalizeTime(timePart)}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(s) && fallbackDate) return `${fallbackDate}T${normalizeTime(s)}`;
  return s;
}

function normalizeTime(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})[.:](\d{2})/);
  if (!m) return s || '19:30';
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

function yn(v) {
  const s = String(v || '').trim().toLowerCase();

  if (['yes', 'ja', 'true', '1'].includes(s)) return 'yes';
  if (['no', 'nej', 'false', '0', ''].includes(s)) return 'no';

  return s;
}

function isYes(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['yes', 'ja', 'true', '1', 'x'].includes(s);
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]/g, '');
}

function fallbackMembers() {
  return [
    { id: '1', name: 'Peter Andersen' },
    { id: '2', name: 'Lars Møller Andersen' },
    { id: '3', name: 'Ivar Lind Bendixen' },
    { id: '4', name: 'Mone Brandstrup' },
    { id: '5', name: 'Christian Peter Brandstrup' },
    { id: '6', name: 'Svend Erik Christensen' },
    { id: '7', name: 'Jens Carsten Kilian Christiansen' },
    { id: '8', name: 'Mogens Dahl' },
    { id: '9', name: 'Anton Edholm' },
    { id: '10', name: 'Per Egekjær' },
    { id: '11', name: 'Ib Kurt Grøn' },
    { id: '12', name: 'Bjarne Halleby Hansen' },
    { id: '13', name: 'Lars Rohde Hansen' },
    { id: '14', name: 'Finn Hansen' },
    { id: '15', name: 'Lars Bo Hansen' },
    { id: '16', name: 'Ole John Hansen' },
    { id: '17', name: 'Bent Kragh Jacobsen' },
    { id: '18', name: 'Kurt Jensen' },
    { id: '19', name: 'Claus Johnny Johansen' },
    { id: '20', name: 'Kim Karlsson' },
    { id: '21', name: 'John Kristensen' },
    { id: '22', name: 'Bøje Skov Larsen' },
    { id: '23', name: 'Niels-Ebbe Dalsø Larsen' },
    { id: '24', name: 'Per Henchel Madsen' },
    { id: '25', name: 'Bjørn Mikkelsen' },
    { id: '26', name: 'Hans Nielsen' },
    { id: '27', name: "Henry O'Connor" },
    { id: '28', name: 'Lars Weide Olsen' },
    { id: '29', name: 'Daniel Holm Olsen' },
    { id: '30', name: 'Freddy Tage Ottosen' },
    { id: '31', name: 'Gert Sunesen' },
    { id: '32', name: 'Henning Søndermølle' },
    { id: '33', name: 'Torben Møller Sørensen' }
  ];
}

function setupInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.installBtn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    els.installBtn.hidden = true;
    state.deferredInstallPrompt = null;
  });
}

async function installApp() {
  if (!state.deferredInstallPrompt) return;

  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;

  state.deferredInstallPrompt = null;
  els.installBtn.hidden = true;
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.warn);
  }
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));
}

function cap(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
}

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
