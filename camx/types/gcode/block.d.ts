import { BlockPart } from './block-part';
import { Word } from './word';
export declare class Block {
    text: string;
    line: number;
    parts: Array<BlockPart<string | Word[]>>;
    errors: string[];
    constructor(text: string);
}
