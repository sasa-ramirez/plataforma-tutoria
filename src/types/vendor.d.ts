// Paquetes CJS sin tipos propios (usados solo detrás de import() dinámico
// en la generación del informe periódico — ver src/lib/exportPeriodicReport.ts).
declare module "pizzip" {
  export default class PizZip {
    constructor(data: Uint8Array | ArrayBuffer | string);
  }
}

declare module "docxtemplater-image" {
  export default class ImageModule {
    constructor(opts: {
      centered: boolean;
      getImage: (tagValue: string) => Uint8Array;
      getSize: (img: Uint8Array, tagValue: string, tagName: string) => [number, number];
    });
  }
}

// Build "bare" de exceljs (sin polyfills de core-js) — mismo código que
// el paquete normal, solo cambia el bundle; reusa sus mismos tipos.
declare module "exceljs/dist/exceljs.bare.min.js" {
  import ExcelJS from "exceljs";
  export default ExcelJS;
}
