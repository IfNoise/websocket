import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from '@reduxjs/toolkit/query'
import { localStorageMiddleware, reHydrateStore } from "./localStoreMiddleware";
import { deviceApi } from "./deviceApi";

const reducer = {
  [deviceApi.reducerPath]: deviceApi.reducer,
};

export const store = configureStore({
  reducer,
  preloadedState: reHydrateStore(),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([deviceApi.middleware,localStorageMiddleware]),
});

setupListeners(store.dispatch)
