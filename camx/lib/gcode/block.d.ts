import { BlockPart } from './block-part';
import { Word } from './word';
export type Block = {
    text: string;
    line: number;
    parts: BlockPart<string | Word[]>[];
    errors: string[];
};
