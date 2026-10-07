/**
 * Parses a string of gcode instructions, and invokes codeHandlers for each type of
 * command or values.
 */
import { Block } from '../gcode';
export declare class GCodeParser {
    static skipCodes: {
        N: string;
    };
    static controlWords: {
        G: string;
        M: string;
        F: string;
        S: string;
        D: string;
        O: string;
    };
    static paramWords: {
        X: string;
        Y: string;
        Z: string;
        A: string;
        B: string;
        C: string;
        I: string;
        J: string;
        K: string;
        R: string;
        L: string;
        P: string;
        Q: string;
    };
    private static valueChars;
    private static blockCommentDepth;
    private static blockCommentEnd;
    static parseBlock(rawText: string): Block;
    static parse(onBlock: (block: Block) => void, gcodeLines: string[], maxErrors?: number): Promise<void>;
}
