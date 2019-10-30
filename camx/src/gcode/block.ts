import { BlockPart } from './block-part'
import { Word } from './word'

export class Block {
  line: number
  parts: Array<BlockPart<string | Word[]>> = []
  errors: string[] = []
  constructor(public text: string) { }

}


