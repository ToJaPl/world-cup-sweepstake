const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=500";

const DRAW = [
  { owner: "Treas", teams: [["Portugal", "🇵🇹"], ["Cape Verde", "🇨🇻"], ["Argentina", "🇦🇷"]] },
  { owner: "Hol", teams: [["Qatar", "🇶🇦"], ["Curaçao", "🇨🇼"], ["Iraq", "🇮🇶"]] },
  { owner: "Jack", teams: [["Norway", "🇳🇴"], ["Senegal", "🇸🇳"], ["Turkey", "🇹🇷"]] },
  { owner: "Leah", teams: [["Netherlands", "🇳🇱"], ["Jordan", "🇯🇴"], ["Panama", "🇵🇦"]] },
  { owner: "Chick", teams: [["USA", "🇺🇸"], ["New Zealand", "🇳🇿"], ["Saudi Arabia", "🇸🇦"]] },
  { owner: "Josh", teams: [["Switzerland", "🇨🇭"], ["Uruguay", "🇺🇾"], ["Congo", "🇨🇬"]] },
  { owner: "Meg", teams: [["South Korea", "🇰🇷"], ["Egypt", "🇪🇬"], ["Australia", "🇦🇺"]] },
  { owner: "Joe", teams: [["Ecuador", "🇪🇨"], ["Tunisia", "🇹🇳"], ["Ivory Coast", "🇨🇮"]] },
  { owner: "Lowri", teams: [["Mexico", "🇲🇽"], ["Austria", "🇦🇹"], ["Paraguay", "🇵🇾"]] },
  { owner: "Lelst", teams: [["Sweden", "🇸🇪"], ["Algeria", "🇩🇿"], ["France", "🇫🇷"]] },
  { owner: "Rhys", teams: [["Canada", "🇨🇦"], ["Morocco", "🇲🇦"], ["Czech Republic", "🇨🇿"]] },
  { owner: "Lucy", teams: [["Belgium", "🇧🇪"], ["Spain", "🇪🇸"], ["Brazil", "🇧🇷"]] },
  { owner: "Izzy", teams: [["Croatia", "🇭🇷"], ["Germany", "🇩🇪"], ["Scotland", "🏴"]] },
  { owner: "Niall", teams: [["Japan", "🇯🇵"], ["South Africa", "🇿🇦"], ["Haiti", "🇭🇹"]] },
  { owner: "James", teams: [["Iran", "🇮🇷"], ["England", "🏴"], ["Bosnia & Herzegovina", "🇧🇦"]] },
  { owner: "Vito", teams: [["Uzbekistan", "🇺🇿"], ["Ghana", "🇬🇭"], ["Colombia", "🇨🇴"]] },
];

const ALIASES = new Map([
  ["united states", "usa"],
  ["usa", "usa"],
  ["us", "usa"],
  ["cote divoire", "ivory coast"],
  ["côte d’ivoire", "ivory coast"],
  ["côte d'ivoire", "ivory coast"],
  ["ivory coast", "ivory coast"],
  ["curacao", "curaçao"],
  ["curaçao", "curaçao"],
  ["czechia", "czech republic"],
  ["czech republic", "czech republic"],
  ["bosnia-herzegovina", "bosnia & herzegovina"],
  ["bosnia and herzogovina", "bosnia & herzegovina"],
  ["bosnia and herzegovina", "bosnia & herzegovina"],
  ["bosnia & herzegovina", "bosnia & herzegovina"],
  ["korea republic", "south korea"],
  ["south korea", "south korea"],
  ["congo dr", "congo"],
  ["dr congo", "congo"],
  ["congo", "congo"],
]);

const byTeam = new Map();
for (const person of DRAW) {
  for (const [team, flag] of person.teams) {
    byTeam.set(canonical(team), { owner: person.owner, team, flag });
  }
}

const els = {
  refresh: document.querySelector("#refresh-button"),
  mobileRefresh: document.querySelector("#mobile-refresh-button"),
  status: document.querySelector("#status-pill"),
  leader: document.querySelector("#leader-name"),
  completed: document.querySelector("#completed-count"),
  headToHead: document.querySelector("#head-to-head-count"),
  nextKickoff: document.querySelector("#next-kickoff"),
  leaderboard: document.querySelector("#leaderboard"),
  fixtures: document.querySelector("#fixtures"),
  ownerGrid: document.querySelector("#owner-grid"),
  teamCount: document.querySelector("#team-count"),
  fixtureRange: document.querySelector("#fixture-range"),
};

els.refresh.addEventListener("click", load);
els.mobileRefresh.addEventListener("click", load);
load();

async function load() {
  setStatus("Refreshing…");
  try {
    const response = await fetch(SCOREBOARD_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Scoreboard returned ${response.status}`);
    const payload = await response.json();
    const events = parseEvents(payload.events || []);
    const stats = buildStats(events);
    render(stats, events);
    setStatus(`Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  } catch (error) {
    render(buildStats([]), []);
    setStatus(`Could not load live results: ${error.message}`);
  }
}

function parseEvents(events) {
  return events.map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((team) => team.homeAway === "home") || competitors[0];
    const away = competitors.find((team) => team.homeAway === "away") || competitors[1];
    const status = competition.status?.type || event.status?.type || {};
    return {
      id: event.id,
      name: event.name,
      date: event.date,
      completed: Boolean(status.completed),
      state: status.state || "",
      detail: status.shortDetail || status.detail || "",
      home: side(home),
      away: side(away),
    };
  }).filter((event) => event.home && event.away);
}

function side(raw) {
  if (!raw) return null;
  const displayName = raw.team?.displayName || raw.team?.name || raw.team?.shortDisplayName || "Unknown";
  const score = raw.score === undefined ? null : Number(raw.score);
  const owned = byTeam.get(canonical(displayName));
  return {
    country: owned?.team || displayName,
    flag: owned?.flag || "",
    owner: owned?.owner || null,
    score,
    winner: Boolean(raw.winner),
  };
}

function buildStats(events) {
  const people = new Map(DRAW.map((person) => [person.owner, {
    owner: person.owner,
    teams: person.teams.map(([name, flag]) => ({
      name,
      flag,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      points: 0,
      next: null,
    })),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }]));

  const teamStats = new Map();
  for (const person of people.values()) {
    for (const team of person.teams) {
      teamStats.set(canonical(team.name), { person, team });
    }
  }

  for (const event of events) {
    const home = teamStats.get(canonical(event.home.country));
    const away = teamStats.get(canonical(event.away.country));
    if (!home && !away) continue;

    if (!event.completed) {
      [home, away].forEach((entry) => {
        if (entry && !entry.team.next) entry.team.next = event;
      });
      continue;
    }

    applyResult(home, event.home.score, event.away.score);
    applyResult(away, event.away.score, event.home.score);
  }

  return [...people.values()].sort((a, b) =>
    b.points - a.points ||
    goalDifference(b) - goalDifference(a) ||
    b.gf - a.gf ||
    a.owner.localeCompare(b.owner)
  );
}

function applyResult(entry, goalsFor, goalsAgainst) {
  if (!entry || goalsFor === null || goalsAgainst === null) return;
  const { person, team } = entry;
  team.played += 1;
  team.gf += goalsFor;
  team.ga += goalsAgainst;
  person.played += 1;
  person.gf += goalsFor;
  person.ga += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    team.wins += 1;
    team.points += 3;
    person.wins += 1;
    person.points += 3;
  } else if (goalsFor < goalsAgainst) {
    team.losses += 1;
    person.losses += 1;
  } else {
    team.draws += 1;
    team.points += 1;
    person.draws += 1;
    person.points += 1;
  }
}

function render(stats, events) {
  const completed = events.filter((event) => event.completed);
  const headToHead = events.filter((event) => event.home.owner && event.away.owner);
  const upcoming = events
    .filter((event) => !event.completed)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  els.leader.textContent = stats[0]?.owner || "—";
  els.completed.textContent = completed.length;
  els.headToHead.textContent = headToHead.length;
  els.nextKickoff.textContent = upcoming[0] ? formatDate(upcoming[0].date) : "Finished";
  els.fixtureRange.textContent = `${events.length || 0} fixtures`;
  els.teamCount.textContent = `${DRAW.length * 3} teams`;

  renderLeaderboard(stats);
  renderFixtures(events);
  renderOwners(stats);
}

function renderLeaderboard(stats) {
  els.leaderboard.innerHTML = stats.map((person, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(person.owner)}</td>
      <td><div class="team-chips">${person.teams.map((team) => chip(team)).join("")}</div></td>
      <td>${person.wins}</td>
      <td>${person.draws}</td>
      <td>${person.losses}</td>
      <td>${formatSigned(goalDifference(person))}</td>
      <td>${person.points}</td>
    </tr>
  `).join("");
}

function renderFixtures(events) {
  const sorted = [...events].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.date) - new Date(b.date);
  });
  els.fixtures.innerHTML = sorted.map((event) => {
    const ownerVs = event.home.owner && event.away.owner
      ? `${event.home.owner} vs ${event.away.owner}`
      : event.home.owner || event.away.owner || "Unowned";
    const score = event.completed || event.state === "in"
      ? `${event.away.score ?? 0} - ${event.home.score ?? 0}`
      : formatDate(event.date);
    return `
      <article class="fixture-card ${event.completed ? "completed" : ""} ${event.state === "in" ? "live" : ""}">
        <div class="fixture-top">
          <span>${escapeHtml(event.detail || formatDate(event.date))}</span>
          <span class="owner-vs">${escapeHtml(ownerVs)}</span>
        </div>
        <div class="match-line">
          ${fixtureSide(event.away)}
          <strong class="score">${escapeHtml(score)}</strong>
          ${fixtureSide(event.home)}
        </div>
      </article>
    `;
  }).join("");
}

function renderOwners(stats) {
  els.ownerGrid.innerHTML = stats.map((person) => `
    <article class="owner-card">
      <h3>${escapeHtml(person.owner)} · ${person.points} pts</h3>
      <div class="team-list">
        ${person.teams.map((team) => `
          <div class="team-row">
            <span>${team.flag} ${escapeHtml(team.name)}</span>
            <span class="record">${team.wins}-${team.draws}-${team.losses}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function fixtureSide(team) {
  return `
    <span class="side">
      <span class="country">${team.flag} ${escapeHtml(team.country)}</span>
      <span class="owner">${team.owner ? escapeHtml(team.owner) : "No owner"}</span>
    </span>
  `;
}

function chip(team) {
  const cls = team.wins ? "win" : team.losses ? "loss" : team.draws ? "draw" : "";
  return `<span class="chip ${cls}">${team.flag} ${escapeHtml(team.name)}</span>`;
}

function goalDifference(row) {
  return row.gf - row.ga;
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canonical(value) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES.get(cleaned) || cleaned;
}

function setStatus(text) {
  els.status.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
