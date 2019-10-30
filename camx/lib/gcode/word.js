import { BlockPart } from './block-part';
export class Word extends BlockPart {
    constructor(literal, address) {
        super(literal + address);
        this.literal = literal;
        this.address = address;
    }
}
//# sourceMappingURL=word.js.map