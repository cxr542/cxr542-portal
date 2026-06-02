export function summarizeMonthlyDistance(logs, targetDate = new Date()) {
  const month = targetDate.getMonth();
  const year = targetDate.getFullYear();
  const monthLogs = logs.filter((log) => {
    const createdAt = new Date(log.createdAt);
    return createdAt.getFullYear() === year && createdAt.getMonth() === month;
  });
  const totalKm = monthLogs.reduce((sum, log) => sum + Number(log.distance || 0), 0);
  return { count: monthLogs.length, totalKm };
}
