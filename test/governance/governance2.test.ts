// // @ts-ignore
// import chai from "chai";
// // @ts-ignore
// import chaiAsPromised from "chai-as-promised";
// // @ts-ignore
// import { ethers, network, artifacts, deployments, waffle } from "hardhat";
// import type * as ethersTypes from "ethers";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { BigNumber } from "ethers";
// import { advanceTimeAndBlockNTimes } from "../utils/TimeTravel";
// import { smockit } from '@eth-optimism/smock'
//
//
// const {
// 	expectRevert,
// 	expectEvent,
// 	time,
// 	constants,
// } = require("@openzeppelin/test-helpers");
// const RLP = require("rlp");
//
// chai.use(chaiAsPromised);
//
// const bigNum = (num: number) => num + "0".repeat(18);
// const zeroAddress = "0x0000000000000000000000000000000000000000";
// const expect = chai.expect;
// const provider = waffle.provider;
//
// const communityMinTranche = bigNum(100);
// const communityMaxTranche = bigNum(5000);
//
// const VOTING_PERIOD_BLOCKS = 17280; // about 1 day
// const VOTING_DELAY_BLOCKS = 17280 * 2; // about 2 days
// const EPOCH_SIZE = 17280;
//
// // Contracts
// let IPCTToken: ethersTypes.ContractFactory;
// let IPCTDelegate: ethersTypes.ContractFactory;
// let IPCTDelegator: ethersTypes.ContractFactory;
// let IPCTTimelock: ethersTypes.ContractFactory;
// let CommunityFactory: ethersTypes.ContractFactory;
// let CommunityAdmin: ethersTypes.ContractFactory;
// let Treasury: ethersTypes.ContractFactory;
// let TestToken: ethersTypes.ContractFactory;
//
// //users
// let owner: SignerWithAddress;
// let alice: SignerWithAddress;
// let bob: SignerWithAddress;
// let carol: SignerWithAddress;
//
// // contract instances
// let ipctToken: ethersTypes.Contract;
// let ipctDelegate: ethersTypes.Contract;
// let ipctDelegator: ethersTypes.Contract;
// let ipctTimelock: ethersTypes.Contract;
// let communityFactory: ethersTypes.Contract;
// let communityAdmin: ethersTypes.Contract;
// let treasury: ethersTypes.Contract;
// let cUSD: ethersTypes.Contract;
// let testToken2: ethersTypes.Contract;
// let testToken3: ethersTypes.Contract;
//
// async function advanceNBlocks(n: number) {
// 	// advanceTimeAndBlockNTimes(n, EPOCH_SIZE)
// 	while (n) {
// 		n--;
// 		await network.provider.send("evm_mine");
// 	}
// }
//
// describe("IPCTGovernator", function () {
// 	before(async function () {
// 		IPCTDelegate = await ethers.getContractFactory("IPCTDelegate");
//
// 		const accounts: SignerWithAddress[] = await ethers.getSigners();
//
// 		owner = accounts[0];
// 		alice = accounts[1];
// 		bob = accounts[2];
// 		carol = accounts[3];
//
// 		console.log("owner:    " + owner.address);
// 		console.log("alice:    " + alice.address);
// 		console.log("bob:      " + bob.address);
// 		console.log("carol:    " + carol.address);
// 	});
//
// 	beforeEach(async function () {
// 		await deployments.fixture();
//
// 		const cUSDDeployment = await deployments.get("TokenMock");
// 		cUSD = await ethers.getContractAt("TokenMock", cUSDDeployment.address);
//
// 		await cUSD.mint(owner.address, bigNum(1000000));
//
// 		const ipctTokenDeployment = await deployments.get("IPCTToken");
// 		ipctToken = await ethers.getContractAt(
// 			"IPCTToken",
// 			ipctTokenDeployment.address
// 		);
//
// 		const ipctTimelockDeployment = await deployments.get("IPCTTimelock");
// 		ipctTimelock = await ethers.getContractAt(
// 			"IPCTTimelock",
// 			ipctTimelockDeployment.address
// 		);
//
// 		const ipctDelegatorDeployment = await deployments.get("IPCTDelegator");
// 		ipctDelegator = await ethers.getContractAt(
// 			"IPCTDelegator",
// 			ipctDelegatorDeployment.address
// 		);
//
// 		ipctDelegator = await IPCTDelegate.attach(ipctDelegator.address);
//
// 		const communityAdminDeployment = await deployments.get(
// 			"CommunityAdmin"
// 		);
// 		communityAdmin = await ethers.getContractAt(
// 			"CommunityAdmin",
// 			communityAdminDeployment.address
// 		);
//
// 		const communityFactoryDeployment = await deployments.get(
// 			"CommunityFactory"
// 		);
// 		communityFactory = await ethers.getContractAt(
// 			"CommunityFactory",
// 			communityFactoryDeployment.address
// 		);
//
// 		const treasuryDeployment = await deployments.get("Treasury");
// 		treasury = await ethers.getContractAt(
// 			"Treasury",
// 			treasuryDeployment.address
// 		);
//
// 		await ipctToken.transfer(alice.address, bigNum(1000000000));
// 		await ipctToken.transfer(bob.address, bigNum(1000000000));
// 		await ipctToken.transfer(carol.address, bigNum(1000000000));
//
// 		await ipctToken.delegate(owner.address);
// 		await ipctToken.connect(alice).delegate(alice.address);
// 		await ipctToken.connect(bob).delegate(bob.address);
// 		await ipctToken.connect(carol).delegate(carol.address);
// 	});
//
// 	it("should create community", async function () {
// 		// Smockit!
// 		const ipctDelegatorMock = await smockit(ipctDelegator)
//
// 		ipctDelegatorMock.smocked.delegateTo.will.return.with();
//
//
// 		await ipctToken.transfer(ipctDelegatorMock.address, bigNum(1234));
//
// 		const targets = [communityAdmin.address];
// 		const values = [0];
// 		const signatures = [
// 			"addCommunity(address,uint256,uint256,uint256,uint256)",
// 		];
//
// 		const calldatas = [
// 			ethers.utils.defaultAbiCoder.encode(
// 				["address", "uint256", "uint256", "uint256", "uint256"],
// 				[alice.address, bigNum(100), bigNum(1000), 1111, 111]
// 			),
// 		];
// 		const descriptions = "description";
//
// 		await expect(
// 			ipctDelegatorMock.propose(
// 				targets,
// 				values,
// 				signatures,
// 				calldatas,
// 				descriptions
// 			)
// 		).to.be.fulfilled;
//
// 		// await advanceNBlocks(VOTING_DELAY_BLOCKS);
//
// 		// await expect(ipctDelegator.castVote(1, 1)).to.be.fulfilled;
// 		// await expect(ipctDelegator.connect(alice).castVote(1, 1)).to.be
// 		// 	.fulfilled;
// 		//
// 		// await advanceNBlocks(6);
// 		//
// 		// await network.provider.send("evm_increaseTime", [1000000]);
// 		//
// 		// await expect(ipctDelegator.connect(alice).queue(1)).to.be.fulfilled;
// 		//
// 		// await expect(ipctDelegator.connect(alice).execute(1)).to.be.fulfilled;
// 	});
// });
