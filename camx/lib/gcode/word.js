"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Word = void 0;
const block_part_1 = require("./block-part");
class Word extends block_part_1.BlockPart {
    constructor(literal, address) {
        super(literal + address);
        this.literal = literal;
        this.address = address;
    }
}
exports.Word = Word;
