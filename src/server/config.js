const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max ? number : fallback;
}

export function bandAgentConfigured(env, prefix) {
  return Boolean(
    UUID.test(env[`${prefix}_AGENT_ID`] || '') &&
    UUID.test(env[`${prefix}_ROOM_ID`] || '') &&
    env[`${prefix}_API_KEY`],
  );
}
