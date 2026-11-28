// Thin TypeScript worker entry so Vite bundles the PDF.js worker as a `.js` file
// (avoiding `.mjs` MIME-type rejections on legacy HTTP servers like Mongoose in kmxWeb).
import 'pdfjs-dist/build/pdf.worker.min.mjs';
