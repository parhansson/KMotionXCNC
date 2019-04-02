// Copyright (c) 2016 par.hansson@gmail.com
/**
 * Parses a string of gcode instructions, and invokes codeHandlers for each type of
 * command or values.
 */
import { Observer } from 'rxjs'
import {
  Word,
  BlockPart,
  Block,
  WordParameters,
  Comment,
  ControlWord,
  ParamWord
} from './gcode'


class ParseValue {
  static None = 0
  static Comment = 1
  static ControlWord = 2
  static ParamWord = 3

  val: string = ''
  letter: string = null
  type: number = ParseValue.None

  constructor() { }

  toPart() {
    switch (this.type) {
      case (ParseValue.Comment):
        return new Comment(this.val)
      case (ParseValue.ParamWord):
        return new ParamWord(this.letter, parseFloat(this.val))
      case (ParseValue.ControlWord):
        return new ControlWord(this.letter, parseFloat(this.val))
    }
  }
  next(block: Block, nextType: number, nextLetter?: string) {

    if (this.type === ParseValue.ParamWord) {
      (block.parts[block.parts.length - 1] as WordParameters).value.push(this.toPart() as Word)
    } else if (this.type !== ParseValue.None) {
      block.parts.push(this.toPart())
    }

    if (ParseValue.ParamWord === nextType && this.type !== ParseValue.ParamWord) {
      block.parts.push(new WordParameters())
    }

    this.letter = nextLetter
    this.type = nextType
    this.val = ''
  }
}

export class GCodeParser {
  // Search for codes without space between them
  public static skipCodes = {
    N: 'Line number'
  }
  public static controlWords = {
    G: 'G codes, Interpolate, rapid traverse etc',
    M: 'M code',
    F: 'Set Feed rate in/min or mm/min',
    S: 'Spindle Speed',
    D: 'Tool',
    O: 'Subroutine Label'
  }
  public static paramWords = {
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
  }

  private static valueChars = '+-0123456789.'
  private static blockCommentDepth = {
    '(': 1,
    ';': Infinity
  }

  private static blockCommentEnd = ')'

  public static parseBlock(rawText: string) {
    const block = new Block(rawText)
    const text = rawText.toUpperCase()
    const len = text.length
    const part = new ParseValue()
    let commentDepth = 0
    for (let x = 0; x < len; x++) {
      const c = text.charAt(x)
      /* tslint:disable:no-conditional-assignment */
      if (commentDepth == 0 && (commentDepth += (GCodeParser.blockCommentDepth[c] || 0)) > 0) {
        part.next(block, ParseValue.Comment)
      } else if (c === GCodeParser.blockCommentEnd) {
        commentDepth -= 1
        part.val += c
        continue
      }
      if (commentDepth > 0) {
        part.val += c
      } else if (GCodeParser.valueChars.indexOf(c) >= 0) {
        part.val += c
      } else if (GCodeParser.controlWords[c]) {
        part.next(block, ParseValue.ControlWord, c)
      } else if (GCodeParser.paramWords[c]) {
        part.next(block, ParseValue.ParamWord, c)
      } else if (GCodeParser.skipCodes[c]) {
        part.next(block, ParseValue.Comment, c)
      } else {
        if (c !== ' ' && c !== '\r') {
          console.log('Strange unhandled character?', '"' + c + '"', c.charCodeAt(0))
        }
      }
    }
    part.next(block, ParseValue.None)
    return block
  }

  static parse(observer: Observer<Block>, gcodeLines: string[]) {
    console.time('parsing')
    let i = 0
    for (const line of gcodeLines) {
      const block = GCodeParser.parseBlock(line)
      block.line = i++
      observer.next(block)

    }
    console.timeEnd('parsing')
    observer.complete()

  }

}

