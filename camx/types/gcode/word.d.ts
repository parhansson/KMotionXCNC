import { BlockPart } from './block-part';
export declare abstract class Word extends BlockPart<string> {
    literal: string;
    address: number;
    constructor(literal: string, address: number);
}
