import axios, { AxiosResponse } from 'axios';

interface PostCallResponse {
  success: boolean;
  data?: any;
  errMessage?: string;
}

export async function postCall(
  url: string,
  token: string,
  payload: any
): Promise<PostCallResponse> {
  try {
    const response: AxiosResponse = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error(`Error in postCall to ${url}:`, error.response?.data || error.message);
    return { success: false, errMessage: error.response?.data || error.message };
  }
}

// export async function getCall(
//   url: string,
//   token: string
// ): Promise<PostCallResponse> {
//   try {
//     const response: AxiosResponse = await axios.get(url, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     });

//     return { success: true, data: response.data };
//   } catch (error: any) {
//     console.error(`Error in getCall to ${url}:`, error.response?.data || error.message);
//     return { success: false, errMessage: error.response?.data || error.message };
//   }
// }
