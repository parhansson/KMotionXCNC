export declare class SVGModelSettings {
    private UnitsPerInch;
    unit: 'mm' | 'in';
    dpi: number;
    renderText: boolean;
    getDPIScaleFactor(dpi?: number): number;
}
export declare class IGMModelSettings {
    scale: number;
    unit: 'mm' | 'in';
    cutZ: number;
    safeZ: number;
    fractionalDigits: number;
    translateToOrigo: boolean;
    removeOutline: boolean;
    removeDuplicates: boolean;
    removeSingularites: boolean;
    initCode: string;
    feedRate: number;
    passes: number;
    materialWidth: number;
}
export declare class PDFModelSettings {
    page: number;
    rotate: number;
    scale: number;
}
export declare class Material {
    name: string;
    ppi: string;
    speed: string;
    passes: number;
    thickness: number;
}
export declare class ModelSettings {
    svg: SVGModelSettings;
    pdf: PDFModelSettings;
    igm: IGMModelSettings;
    materials: Material[];
    update(from: ModelSettings): void;
}
