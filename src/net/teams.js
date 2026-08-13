export function computeTeams(playerIds) {
  const sorted = [...playerIds].sort();

  const teams = {};

  sorted.forEach((id, index) => {
    teams[id] = index % 2 === 0 ? 'CT' : 'T';
  });

  return teams;
}

export function teamColor(team) {
  return team === 'CT' ? 0x4a6fb0 : 0xb04a4a;
}
