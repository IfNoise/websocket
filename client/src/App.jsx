import { Router } from "./routes.jsx";
import { RouterProvider } from "react-router-dom";
import { SnackbarContext } from "./context/SnackbarContext";
import { useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme(
{
    palette: {
      mode: 'light',
      primary: {
        main: '#363f73',
        dark: '#7e89f3',
        contrastText: '#c0f3cd',
      },
      secondary: {
        main: '#f50057',
      },
      background: {
        default: '#a9b4c3',
        paper: '#485562',
      },
      divider: 'rgba(35,46,59,0.12)',
    },
  })

function App() {

  const [snack, setSnack] = useState({
    message: '',
    severity: '',
    open: false,
  });
  return (
      <SnackbarContext.Provider value={{ snack, setSnack }}>

      <RouterProvider router={Router} />

      </SnackbarContext.Provider>
  );
}

export default App;
