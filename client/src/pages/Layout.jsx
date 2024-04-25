import { Outlet, Link, Navigate, useLocation } from "react-router-dom";
import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import SnackBar from "../components/SnackBar/SnackBar";


export const Layout = () => {

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <MuiAppBar position="fixed">
        <Toolbar sx={{width:'100%'}}>
            
        </Toolbar>
       </MuiAppBar>
        <Box sx={{}}>
        <Outlet />
        </Box>
        <SnackBar />
    </Box>
  );
};
