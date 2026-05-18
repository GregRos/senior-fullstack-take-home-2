import App from "@/App"
import { MantineProvider } from "@mantine/core"
import "@mantine/core/styles.css"
import ReactDOM from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

const router = createBrowserRouter([
    {
        path: "/*",
        element: <App />
    }
])

ReactDOM.createRoot(document.getElementById("root")!).render(
    <MantineProvider>
        <RouterProvider router={router} />
    </MantineProvider>
)
