const normBag = (s) => String(s ?? '').trim().toUpperCase();

/**
 * Sum of CWT (weight) already committed to a given bag across saved job
 * entries in the engage context. A single bag may now be assigned to many
 * material rows / jobs, so the total weight pulled from a bag must never
 * exceed its available stock.
 *
 * @param {object} jobEntries   state.jobEntries from EngageContext
 * @param {string} rfbag        the bag barcode to total up
 * @param {string|null} excludeJobId  a job key to skip (the one being edited,
 *                                     so its in-progress rows aren't double counted)
 */
export const sumSavedBagCwt = (jobEntries, rfbag, excludeJobId = null) => {
  if (!rfbag) return 0;
  const target = normBag(rfbag);
  let total = 0;
  Object.entries(jobEntries || {}).forEach(([jobId, je]) => {
    if (excludeJobId != null && normBag(jobId) === normBag(excludeJobId)) return;
    (je?.bags || []).forEach((b) => {
      const bagRf = b.rfbag ?? b.assignedBag;
      if (bagRf && normBag(bagRf) === target) total += Number(b.wt) || 0;
    });
  });
  return total;
};

export const getClientIpAddress = async () => {
  try {
    const cachedIp = sessionStorage.getItem("clientIpAddress");
    if (cachedIp) return cachedIp;
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    const ip = data?.ip || "";
    sessionStorage.setItem("clientIpAddress", ip);
    return ip;
  } catch (error) {
    console.error("Error fetching IP address:", error);
    return "";
  }
};
