// Copyright (c) 2016 par.hansson@gmail.com
/**
 * Parses a string of gcode instructions, and invokes codeHandlers for each type of
 * command or values.
 */
import { Block, WordParameters, Comment, ControlWord, ParamWord } from '../gcode';
class ParseValue {
    constructor() {
        this.val = '';
        this.letter = null;
        this.type = ParseValue.None;
    }
    toPart() {
        switch (this.type) {
            case (ParseValue.Comment):
                return new Comment(this.val);
            case (ParseValue.ParamWord):
                return new ParamWord(this.letter, parseFloat(this.val));
            case (ParseValue.ControlWord):
                return new ControlWord(this.letter, parseFloat(this.val));
        }
    }
    next(block, nextType, nextLetter) {
        if (this.type === ParseValue.ParamWord) {
            block.parts[block.parts.length - 1].value.push(this.toPart());
        }
        else if (this.type !== ParseValue.None) {
            block.parts.push(this.toPart());
        }
        if (ParseValue.ParamWord === nextType && this.type !== ParseValue.ParamWord) {
            block.parts.push(new WordParameters());
        }
        this.letter = nextLetter;
        this.type = nextType;
        this.val = '';
    }
}
ParseValue.None = 0;
ParseValue.Comment = 1;
ParseValue.ControlWord = 2;
ParseValue.ParamWord = 3;
export class GCodeParser {
    static parseBlock(rawText) {
        const block = new Block(rawText);
        const text = rawText.toUpperCase();
        const len = text.length;
        const part = new ParseValue();
        let commentDepth = 0;
        for (let x = 0; x < len; x++) {
            const c = text.charAt(x);
            /* tslint:disable:no-conditional-assignment */
            if (commentDepth == 0 && (commentDepth += (GCodeParser.blockCommentDepth[c] || 0)) > 0) {
                part.next(block, ParseValue.Comment);
            }
            else if (c === GCodeParser.blockCommentEnd) {
                commentDepth -= 1;
                part.val += c;
                continue;
            }
            if (commentDepth > 0) {
                part.val += c;
            }
            else if (GCodeParser.valueChars.indexOf(c) >= 0) {
                part.val += c;
            }
            else if (GCodeParser.controlWords[c]) {
                part.next(block, ParseValue.ControlWord, c);
            }
            else if (GCodeParser.paramWords[c]) {
                part.next(block, ParseValue.ParamWord, c);
            }
            else if (GCodeParser.skipCodes[c]) {
                part.next(block, ParseValue.Comment, c);
            }
            else {
                if (c !== ' ' && c !== '\r') {
                    block.errors.push(`Invalid character "${c}" charcode "${c.charCodeAt(0)}"`);
                }
            }
        }
        part.next(block, ParseValue.None);
        return block;
    }
    static parse(onBlock, gcodeLines, maxErrors = 100) {
        console.time('parsing');
        return new Promise((resolve, reject) => {
            let i = 0;
            let totalErrors = 0;
            for (const line of gcodeLines) {
                const block = GCodeParser.parseBlock(line);
                totalErrors += block.errors.length;
                if (totalErrors > maxErrors) {
                    const errorMsg = `Max total errors ${maxErrors} reached giving up`;
                    console.log(errorMsg);
                    reject(errorMsg);
                    console.timeEnd('parsing');
                    return;
                }
                block.line = i++;
                if (block.errors.length === 0) {
                    onBlock(block);
                }
            }
            console.timeEnd('parsing');
            resolve();
        });
    }
}
// Search for codes without space between them
GCodeParser.skipCodes = {
    N: 'Line number'
};
GCodeParser.controlWords = {
    G: 'G codes, Interpolate, rapid traverse etc',
    M: 'M code',
    F: 'Set Feed rate in/min or mm/min',
    S: 'Spindle Speed',
    D: 'Tool',
    O: 'Subroutine Label'
};
GCodeParser.paramWords = {
    X: 'X axis',
    Y: 'Y axis',
    Z: 'Z axis',
    A: 'A axis',
    B: 'B axis',
    C: 'C axis',
    //E: 'E axis present in 3d printer gcode files',
    I: 'I parameter on G2,G3',
    J: 'J parameter on G2,G3',
    K: 'K parameter on G2,G3',
    R: 'R parameter on G2,G3',
    L: 'G10 parameter',
    P: 'G10 parameter',
    Q: 'G73, G83 parameter Peck increment in canned cycles (peck drilling cycles)'
};
GCodeParser.valueChars = '+-0123456789.';
GCodeParser.blockCommentDepth = {
    '(': 1,
    ';': Infinity
};
GCodeParser.blockCommentEnd = ')';
//# sourceMappingURL=gcode-parser.js.map