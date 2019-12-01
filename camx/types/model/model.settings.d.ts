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
    removeSingularites: boolean;
    joinAdjacent: boolean;
    calculateShortestPath: boolean;
    initCode: string;
    feedRate: number;
    multipass: false;
    materialThickness: number;
    passes: number;
}
export declare class PDFModelSettings {
    page: number;
    rotate: number;
    scale: number;
}
export declare class DXFModelSettings {
    includeDimension: true;
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
    dxf: DXFModelSettings;
    materials: Material[];
    update(from: ModelSettings): void;
}
