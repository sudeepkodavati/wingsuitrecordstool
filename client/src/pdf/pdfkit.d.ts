// pdfkit's browser build bundles its fonts and Node shims; it exposes the same API as `pdfkit`.
declare module 'pdfkit/js/pdfkit.standalone.js' {
  import PDFDocument from 'pdfkit';
  export default PDFDocument;
}
