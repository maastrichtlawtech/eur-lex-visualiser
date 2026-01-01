import React from "react";
import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration } from "react-router-dom";
import { Landing } from "./components/Landing.jsx";
import { LawViewer } from "./components/LawViewer.jsx";
import { ThemeProvider } from "./components/ThemeProvider.jsx";

function Layout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Landing />,
      },
      {
        path: "law/:key",
        element: <LawViewer />,
      },
      {
        path: "law/:key/:kind/:id",
        element: <LawViewer />,
      },
      {
        path: "extension",
        element: <LawViewer />,
      },
      {
        path: "extension/:kind/:id",
        element: <LawViewer />,
      },
    ],
  },
], {
  basename: "/",
});

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
