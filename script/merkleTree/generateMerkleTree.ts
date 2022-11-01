const {MerkleTree} = require("merkletreejs")
const keccak256 = require("keccak256")
import {beneficiaryList} from "./beneficiaryList_test";
// import {beneficiaryList} from "./beneficiaryList_prod";

let merkleTree: any;

export function generateMerkleTree(addresses: string[]): string {
    let leaves = addresses.map(addr => keccak256(addr))
    merkleTree = new MerkleTree(leaves, keccak256, {sortPairs: true})
    let rootHash = merkleTree.getRoot().toString('hex')

    return '0x' + rootHash;
}

export function getProof(address: string): any {
    const hashedAddress = keccak256(address)
    return merkleTree.getHexProof(hashedAddress);
}


export function generateMerkleTreeFromFile() {
    return generateMerkleTree(beneficiaryList);
}
