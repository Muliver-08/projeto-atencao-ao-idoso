import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import "./index.css"
import Layout from "@/components/Layout"
import Home from "@/pages/Home"
import Idosos from "@/pages/Idosos"
import IdosoDetalhe from "@/pages/IdosoDetalhe"
import Cuidadores from "@/pages/Cuidadores"

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "idosos", Component: Idosos },
      { path: "idosos/:id", Component: IdosoDetalhe },
      { path: "cuidadores", Component: Cuidadores },
    ],
  },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
