import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";

import { Layout } from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";


export const Router = createBrowserRouter(
  createRoutesFromElements(
    <>
    <Route path="/" element={<Layout />}>
      <Route index element={< Dashboard/>} />      
      <Route path="/settings" element={<Settings/>} />
    </Route>
    </>
  )
);