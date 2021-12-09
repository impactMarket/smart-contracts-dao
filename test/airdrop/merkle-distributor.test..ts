// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import BalanceTree from "../../airdrop_scripts/balance-tree";

chai.use(chaiAsPromised);
const expect = chai.expect;

let owner: SignerWithAddress;
let account1: SignerWithAddress;
let account2: SignerWithAddress;

let MerkleDistributor: ethersTypes.Contract;
let PACT: ethersTypes.Contract;

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

	it.only("Should be able to claim reward", async function () {
		const initialBalance = await PACT.balanceOf(account1.address);

		let tree: BalanceTree;
		tree = new BalanceTree([
			{ account: account1.address, amount: parseEther("100") },
			{ account: account2.address, amount: parseEther("200") },
		]);

		const proof0 = tree.getProof(0, account1.address, parseEther("100"));

		await expect(
			MerkleDistributor.claim(
				0,
				account1.address,
				parseEther("100"),
				proof0
			)
		)
			.to.emit(MerkleDistributor, "Claimed")
			.withArgs(0, account1.address, parseEther("100"));

		const finalBalance = await PACT.balanceOf(account1.address);

		expect(finalBalance.sub(initialBalance)).to.be.equal(parseEther("100"));

		expect(await PACT.balanceOf(account2.address)).to.be.equal(parseEther("0"));
	});
});
