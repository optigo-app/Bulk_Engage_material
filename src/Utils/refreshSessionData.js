import { CallApi } from '../API/CallApi/CallApi';
import { setMaster } from './masterStore';

/**
 * Re-fetches all master data from the API and refreshes sessionStorage.
 * Reads reportVarible and clientIpAddress from sessionStorage automatically.
 */
export const refreshSessionData = async (setIsLoading) => {
  const reportVarRaw = sessionStorage.getItem('reportVarible');
  if (!reportVarRaw) return;
  setIsLoading(true);
  let AllData;
  try {
    AllData = JSON.parse(reportVarRaw);
  } catch {
    return;
  }

  const clientIpAddress = sessionStorage.getItem('clientIpAddress') || '';

  const makeBody = (mode, f) => ({
    con: JSON.stringify({
      id: '',
      mode,
      appuserid: AllData?.LUId,
      IPAddress: clientIpAddress,
    }),
    p: JSON.stringify({}),
    f,
  });

  const [
    responseLocker,
    response,
    responseJobList,
    responseBagList,
    responseEmployeeLocker,
    responseJobMaterial,
    responseEngagedMaterial,
  ] = await Promise.all([
    CallApi(makeBody('getlocker', 'getlocker (get getlocker data)')),
    CallApi(makeBody('getemplist', 'BulkEngage (get employee)')),
    CallApi(makeBody('joblist', 'joblist (get joblist data)')),
    CallApi(makeBody('materiallist', 'materiallist (get materiallist data)')),
    CallApi(makeBody('getemplocker', 'materiallist (get materiallist data)')),
    CallApi(makeBody('order_joblist', 'joblist (get joblist data)')),
    CallApi(makeBody('engagedmateriallist', 'materiallist (get materiallist data)')),
  ]);

  const materialLines = ((responseJobMaterial?.rd) || []).filter(
    (material) => material.shape !== "Stamping",
  );
  setIsLoading(false);
  if (responseLocker?.rd) setMaster('allLockerData', responseLocker.rd);
  if (response?.rd) setMaster('allEmployeeData', response.rd);
  if (responseJobList?.rd) setMaster('allJobListData', responseJobList.rd);
  if (responseBagList?.rd) setMaster('allBagListData', responseBagList.rd);
  if (responseEmployeeLocker?.rd) setMaster('allEmployeeLockerData', responseEmployeeLocker.rd);
  if (responseJobMaterial?.rd) setMaster('allJobMaterialData', materialLines);
  if (responseEngagedMaterial?.rd) setMaster('allEngagedMaterial', responseEngagedMaterial.rd);
};
