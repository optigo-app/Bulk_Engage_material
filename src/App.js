// E0010

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EngageProvider } from './context/EngageContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import ScanEmployee from './pages/ScanEmployee/ScanEmployee';
import SelectLocker from './pages/SelectLocker/SelectLocker';
import SelectProcess from './pages/SelectProcess/SelectProcess';
import ScanJobs from './pages/ScanJobs/ScanJobs';
import BagScanning from './pages/BagScanning/BagScanning';
import MaterialEntry from './pages/MaterialEntry/MaterialEntry';
import Summary from './pages/Summary/Summary';
import Confirmation from './pages/Confirmation/Confirmation';
import './styles/global.scss';
import { getClientIpAddress } from './Utils/globalFunc';
import axios from 'axios';
import { CallApi } from './API/CallApi/CallApi';

function App() {

  const [tokenMissing, setTokenMissing] = useState(false);
  const searchParams = new URLSearchParams(window.location.search);
  const newToken = searchParams.get("Token");

  useEffect(() => {
    getClientIpAddress();
  }, []);


  // useEffect(() => {
  //   sessionStorage.setItem("5F383721-FC33-F111-B3AE-F875A496BA9D", JSON?.stringify({
  //     "tkn": "OTA2NTQ3MTcwMDUrdzNTY1MQ==",
  //     "pid": 18333,
  //     "IsEmpLogin": 0,
  //     "IsPower": 0,
  //     "SpNo": "MA==",
  //     "SpVer": "",
  //     "SV": "MA==",
  //     "LId": "MTE=",
  //     "LUId": "c3dhbWlAZWcuY29t",
  //     "DAU": "aHR0cDovL256ZW4vam8vYXBpLWxpYi9BcHAvQ2VudHJhbEFwaQ==",
  //     "YearCode": "e3tuemVufX17ezIwfX17e29yYWlsMjV9fXt7b3JhaWwyNX19",
  //     "cuVer": "UjUwQjM=",
  //     "dxver": "YmV0YQ==",
  //     "rptapiurl": "aHR0cDovL25ld25leHRqcy53ZWIvYXBpL3JlcG9ydA=="
  //   }))
  //   window.location.replace("http://localhost:3000/?CN=UkRTRF8yMDI2MDQwOTEwMDkwOV9iZGIzY2Y1NjRiNDc0NWJmYWY4NjNkYjBhZmI2MzZmNg==&pid=18333&Token=5F383721-FC33-F111-B3AE-F875A496BA9D");
  // }, []);

  useEffect(() => {
    const initializeAndFetchReport = async () => {
      if (!newToken) {
        setTokenMissing(true);
        return;
      }

      try {
        let parsedData;
        const fromSession = sessionStorage.getItem(newToken);
        const fromLocal = fromSession ? null : localStorage.getItem(newToken);

        if (fromSession) {
          parsedData = JSON.parse(fromSession);
          sessionStorage.setItem("reportVarible", JSON.stringify(parsedData));
        } else if (fromLocal) {
          parsedData = JSON.parse(fromLocal);
          if (parsedData?.LUId) {
            parsedData.LUId = atob(parsedData.LUId);
          }
          sessionStorage.setItem(newToken, JSON.stringify(parsedData));
          sessionStorage.setItem("reportVarible", JSON.stringify(parsedData));
        } else {
          const tokenBody = {
            ReqData: `[{"ForEvt":"GetTokenVal","Token":"${newToken}"}]`,
          };

          const APIURL =
            window.location.hostname === "localhost" ||
              window.location.hostname === "bulkengage.web" ||
              window.location.hostname === "nzen"
              ? "http://nzen/jo/api-lib/App/CentralCrossDomainToken"
              : "https://vw.optigoapps.com/linkedapp/App/CentralCrossDomainToken";

          const tokenResponse = await axios.post(APIURL, tokenBody);
          const tokenData = tokenResponse?.data?.Data?.DT?.[0];

          const returnedToken = tokenData?.Token;
          const jsonDataString = tokenData?.JsonData;

          if (!jsonDataString || !returnedToken) {
            setTokenMissing(true);
            return;
          }

          parsedData = JSON.parse(jsonDataString);
          if (parsedData?.LUId) {
            parsedData.LUId = atob(parsedData.LUId);
          }

          sessionStorage.setItem(newToken, JSON.stringify(parsedData));
          sessionStorage.setItem("reportVarible", JSON.stringify(parsedData));
        }

        const AllData = parsedData;
        console.log('AllData: ', AllData);
        const clientIpAddress = sessionStorage.getItem("clientIpAddress");

        const body = {
          con: JSON.stringify({
            id: "",
            mode: "getemplist",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "BulkEngage (get employee)",
        };

        const bodyMulti = {
          con: JSON.stringify({
            id: "",
            mode: "getlocker",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "getlocker (get getlocker data)",
        };

        const bodyJobList = {
          con: JSON.stringify({
            id: "",
            mode: "joblist",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "joblist (get joblist data)",
        };

        const bodyJobMaterial = {
          con: JSON.stringify({
            id: "",
            mode: "order_joblist",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "joblist (get joblist data)",
        };

        const bodyMaterialList = {
          con: JSON.stringify({
            id: "",
            mode: "materiallist",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "materiallist (get materiallist data)",
        };

        const bodyEmployeeLocker = {
          con: JSON.stringify({
            id: "",
            mode: "getemplocker",
            appuserid: AllData?.LUId,
            IPAddress: clientIpAddress,
          }),
          p: JSON.stringify({}),
          f: "materiallist (get materiallist data)",
        };

        const responseLocker = await CallApi(bodyMulti);
        const response = await CallApi(body);
        const responseJobList = await CallApi(bodyJobList);
        const responseBagList = await CallApi(bodyMaterialList);
        const responseEmployeeLocker = await CallApi(bodyEmployeeLocker);
        const responseJobMaterial = await CallApi(bodyJobMaterial);
        
        if (response?.Status === "400") {
          setTokenMissing(true);
          return;
        }

        if (responseLocker?.rd) {
          sessionStorage.setItem("allLockerData", JSON.stringify(responseLocker?.rd))
        }

        if (response?.rd) {
          sessionStorage.setItem("allEmployeeData", JSON.stringify(response?.rd))
        }

        if (responseJobList?.rd) {
          sessionStorage.setItem("allJobListData", JSON.stringify(responseJobList?.rd))
        }

        if (responseBagList?.rd) {
          sessionStorage.setItem("allBagListData", JSON.stringify(responseBagList?.rd))
        }

         if (responseEmployeeLocker?.rd) {
          sessionStorage.setItem("allEmployeeLockerData", JSON.stringify(responseEmployeeLocker?.rd))
        }

         if (responseJobMaterial?.rd) {
          sessionStorage.setItem("allJobMaterialData", JSON.stringify(responseJobMaterial?.rd))
        }
      } catch (err) {
        console.error("Error:", err);
        setTokenMissing(true);
      }
    };

    initializeAndFetchReport();
  }, [newToken]);




  return (
    <ThemeProvider>
      <EngageProvider>
        <BrowserRouter basename='/'>
          <Layout>
            <Routes>
              <Route path="/" element={<ScanEmployee />} />
              <Route path="/select-locker" element={<SelectLocker />} />
              <Route path="/select-process" element={<SelectProcess />} />
              <Route path="/scan-jobs" element={<ScanJobs />} />
              <Route path="/bag-scanning" element={<BagScanning />} />
              <Route path="/material-entry" element={<MaterialEntry />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/confirmation" element={<Confirmation />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </EngageProvider>
    </ThemeProvider>
  );
}

export default App;