import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Set pdfjs worker to use local pdfjs-dist worker
try {
  // dynamic import to avoid SSR issues
  import('pdfjs-dist/legacy/build/pdf').then((pdfjs) => {
    if (pdfjs && pdfjs.GlobalWorkerOptions) {
      // Use the bundled worker from pdfjs-dist
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.js', import.meta.url).toString();
    }
  });
} catch (e) {
  // ignore if not available in dev environment
  // worker will fall back to CDN when needed
}

createRoot(document.getElementById("root")!).render(<App />);
