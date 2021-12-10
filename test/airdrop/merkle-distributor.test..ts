// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";

chai.use(chaiAsPromised);
const expect = chai.expect;

let owner: SignerWithAddress;
let account1: SignerWithAddress;
let account2: SignerWithAddress;

let MerkleDistributor: ethersTypes.Contract;
let PACT: ethersTypes.Contract;

const merkleTree = require('../../airdrop_scripts/rewards/merkleTree.json');

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner, account1, account2] = await ethers.getSigners();

	MerkleDistributor = await ethers.getContractAt(
		"MerkleDistributor",
		(
			await deployments.get("MerkleDistributor")
		).address
	);

	PACT = await ethers.getContractAt(
		"PACTToken",
		(
			await deployments.get("PACTToken")
		).address
	);
});

describe("Merkle Distributor", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();
	});

	it.only("Should be able to claim reward account #1", async function () {
		const account = '0x0000000072EF09A65BF7715EEE729AC702546aEC';

		const initialBalance = await PACT.balanceOf(account);

		const treeAccount = merkleTree['claims'][account];

		await expect(
			MerkleDistributor.claim(
				treeAccount['index'],
				account,
				treeAccount['amount'],
				treeAccount['proof']
			)
		)
			.to.emit(MerkleDistributor, "Claimed")
			.withArgs(treeAccount['index'], account, treeAccount['amount']);

		const finalBalance = await PACT.balanceOf(account);

		expect(finalBalance.sub(initialBalance)).to.be.equal(treeAccount['amount']);
	});
});
