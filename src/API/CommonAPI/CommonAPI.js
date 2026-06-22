// API/CommonAPI/CommonAPI.js

import axios from "axios";

export const CommonAPI = async (body) => {
  try {
    const rawData = typeof window !== "undefined"
      ? sessionStorage.getItem("reportVarible")
      : null;

    if (!rawData) {
      console.error("No reportVarible found in sessionStorage");
      return [];
    }
    
    const AllData = JSON.parse(rawData);
    const APIURL = atob(AllData?.rptapiurl);
    const header = {
      Yearcode: `${AllData?.YearCode}`,
      version: `${atob(AllData?.cuVer)}`,
      sv: `${atob(AllData?.SV)}`,
      sp: 64,
    };

    const response = await axios.post(APIURL, body, { headers: header });
    return response?.data;
  } catch (error) {
    console.error("error is..", error);
    return error;
  }
};