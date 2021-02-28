import { BlockPart } from './block-part'
export class Comment extends BlockPart<string> { 
    constructor(value) {
        super(value)
    }
}