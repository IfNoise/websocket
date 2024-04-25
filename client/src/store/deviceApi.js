import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {baseUrl} from "../config/config"

export const deviceApi = createApi({
  reducerPath: "device/api",
  baseQuery: fetchBaseQuery({
    baseUrl: baseUrl,
    // prepareHeaders: (headers, { getState }) => {
    //   const token = getState().auth.token
    //   if (token) {
    //     headers.set('authorization', `Bearer ${token}`)
    //   }
    //   return headers
    // },
  }),
  endpoints: (build) => ({
    getDevices: build.query({
      query: () => ({
        url: "devices",
      }),
     // providesTags:['State'],
    }),
    call: build.mutation({
      query(body) {
        return {
          url: `call`,
          method: 'POST',
          body
        }
      },
      //invalidatesTags: ['State'],
    }),
  }),
});

export const { useGetDevicesQuery,useCallMutation, refetch } = deviceApi;
