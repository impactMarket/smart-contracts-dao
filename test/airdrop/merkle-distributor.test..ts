// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import {
	advanceBlockNTimes,
	advanceTimeAndBlockNTimes,
	advanceToBlockN,
} from "../utils/TimeTravel";
import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import {BigNumber, BigNumberish} from "@ethersproject/bignumber";
import BalanceTree from "../../airdrop_scripts/balance-tree";

chai.use(chaiAsPromised);
const expect = chai.expect;

const STARTING_DELAY = 100;
const REWARD_PERIOD_SIZE = 20;
const INITIAL_REWARD = parseEther("100000001");

let owner: SignerWithAddress;
let donor1: SignerWithAddress;

let MerkleDistributor: ethersTypes.Contract;
let PACT: ethersTypes.Contract;

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner, donor1] = await ethers.getSigners();

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

	it.only("Should be able to claim reward", async function () {
		const initialBalance = await PACT.balanceOf(owner.address);

		let tree: BalanceTree;
		tree = new BalanceTree([
			{ account: owner.address, amount: parseEther("100") }
		])
		const proof0 = tree.getProof(0, owner.address, parseEther("100"));

		await expect(MerkleDistributor.claim(0, owner.address, parseEther("100"), proof0))
			.to.emit(MerkleDistributor, 'Claimed')
			.withArgs(0, owner.address, parseEther("100"));

		const finalBalance = await PACT.balanceOf(owner.address);

		expect (finalBalance.sub(initialBalance)).to.be.equal(parseEther("100"))
	});
});
