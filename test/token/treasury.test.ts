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
import { BigNumber } from "@ethersproject/bignumber";

chai.use(chaiAsPromised);
const expect = chai.expect;

let owner: SignerWithAddress;
let owner2: SignerWithAddress;

let ImpactProxyAdmin: ethersTypes.Contract;
let DonationMiner: ethersTypes.Contract;
let PACT: ethersTypes.Contract;
let ImpactLabsVesting: ethersTypes.Contract;
let Treasury: ethersTypes.Contract;
let TreasuryImplementation: ethersTypes.Contract;
let CommunityAdmin: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner, owner2] = await ethers.getSigners();

	TreasuryImplementation = await ethers.getContractAt(
		"TreasuryImplementation",
		(
			await deployments.get("TreasuryImplementation")
		).address
	);

	Treasury = await ethers.getContractAt(
		"TreasuryImplementation",
		(
			await deployments.get("TreasuryProxy")
		).address
	);

	CommunityAdmin = await ethers.getContractAt(
		"CommunityAdminImplementation",
		(
			await deployments.get("CommunityAdminProxy")
		).address
	);

	ImpactProxyAdmin = await ethers.getContractAt(
		"ImpactProxyAdmin",
		(
			await deployments.get("ImpactProxyAdmin")
		).address
	);

	PACT = await ethers.getContractAt(
		"PACTToken",
		(
			await deployments.get("PACTToken")
		).address
	);

	cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await await deployments.get("TokenMock")
		).address
	);

	await cUSD.mint(owner2.address, parseEther("1000000"));
});

describe("Treasury", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();
	});

	it("Should have correct values", async function () {
		expect(await Treasury.communityAdmin()).to.be.equal(CommunityAdmin.address);
		expect(await Treasury.owner()).to.be.equal(owner.address);
	});

	it("Should transfer founds to address is owner", async function () {
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		await cUSD.mint(Treasury.address, parseEther("100"));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			parseEther("100")
		);
		await Treasury.transfer(
			cUSD.address,
			owner.address,
			parseEther("100")
		);
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		expect(await cUSD.balanceOf(owner.address)).to.be.equal(
			parseEther("100")
		);
	});

	it("Should update communityAdmin if owner", async function () {
		await Treasury.updateCommunityAdmin(owner2.address);
		expect(await Treasury.communityAdmin()).to.be.equal(owner2.address);
	});

	it("Should transfer founds to address is communityAdmin", async function () {
		await Treasury.updateCommunityAdmin(owner2.address);

		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		await cUSD.mint(Treasury.address, parseEther("100"));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			parseEther("100")
		);
		await Treasury.connect(owner2).transfer(
			cUSD.address,
			owner.address,
			parseEther("100")
		);
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		expect(await cUSD.balanceOf(owner.address)).to.be.equal(
			parseEther("100")
		);
	});

	it.only("Should update implementation if owner", async function () {
		const NewTreasuryImplementationFactory =
			await ethers.getContractFactory("TreasuryImplementation");
		const NewTreasuryImplementation =
			await NewTreasuryImplementationFactory.deploy();

		await expect(
			ImpactProxyAdmin.upgrade(
				Treasury.address,
				NewTreasuryImplementation.address
			)
		).to.be.fulfilled;
		expect(
			await ImpactProxyAdmin.getProxyImplementation(Treasury.address)
		).to.be.equal(NewTreasuryImplementation.address);
	});

	it("Should not update implementation if not owner", async function () {
		const NewTreasuryImplementationFactory =
			await ethers.getContractFactory("TreasuryImplementation");
		const NewTreasuryImplementation =
			await NewTreasuryImplementationFactory.deploy();

		await expect(
			ImpactProxyAdmin.connect(owner2).upgrade(
				Treasury.address,
				NewTreasuryImplementation.address
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(
			await ImpactProxyAdmin.getProxyImplementation(Treasury.address)
		).to.be.equal(TreasuryImplementation.address);
	});
});
