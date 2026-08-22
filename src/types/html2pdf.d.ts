declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | [number, number] | [number, number, number, number];
    filename?: string;
    image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean; backgroundColor?: string; [key: string]: unknown };
    jsPDF?: { unit?: string; format?: string; orientation?: "portrait" | "landscape" };
    [key: string]: unknown;
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement): Html2Pdf;
    save(): Promise<void>;
    output(type: string): Promise<Blob | string>;
  }

  function html2pdf(): Html2Pdf;
  export default html2pdf;
}
