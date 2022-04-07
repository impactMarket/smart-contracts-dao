// @ts-ignore
import chai from "chai";
// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as ethersTypes from "ethers";
import { fromEther, toEther } from "../utils/helpers";

chai.use(chaiAsPromised);
const expect = chai.expect;

let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;

let ImpactProxyAdmin: ethersTypes.Contract;
let PACT: ethersTypes.Contract;
let Treasury: ethersTypes.Contract;
let TreasuryImplementation: ethersTypes.Contract;
let CommunityAdmin: ethersTypes.Contract;
let UniswapV2Factory: ethersTypes.Contract;
let UniswapRouter: ethersTypes.Contract;
let cUSD: ethersTypes.Contract;
let mUSD: ethersTypes.Contract;
let celo: ethersTypes.Contract;

const FAKE_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const deploy = deployments.createFixture(async () => {
	await deployments.fixture("Test", { fallbackToGlobal: false });

	[owner, user1, user2, user3] = await ethers.getSigners();

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

	UniswapV2Factory = await ethers.getContractAt(
		"UniswapV2Factory",
		(
			await deployments.get("UniswapV2Factory")
		).address
	);

	UniswapRouter = await ethers.getContractAt(
		"UniswapV2Router02",
		(
			await deployments.get("UniswapV2Router02")
		).address
	);

	cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await deployments.get("TokenMock")
		).address
	);

	const tokenFactory = await ethers.getContractFactory("TokenMock");

	mUSD = await tokenFactory.deploy("mUSD", "mUSD");
	celo = await tokenFactory.deploy("celo", "celo");
});

describe("Treasury", () => {
	before(async function () {});

	beforeEach(async () => {
		await deploy();

		await cUSD.mint(user1.address, toEther(100000000));
		await mUSD.mint(user1.address, toEther(100000000));
		await celo.mint(user1.address, toEther(100000000));

		// await UniswapV2Factory.connect(user1).createPair(cUSD.address, mUSD.address);
		//
		// Pair =  await ethers.getContractAt(
		// 	"UniswapV2Pair",
		// 	await UniswapV2Factory.getPair(cUSD.address, mUSD.address)
		// );

		// await cUSD.connect(user1).approve(Pair.address, toEther(10));
		// await mUSD.connect(user1).approve(Pair.address, toEther(10));
		//
		// console.log(await UniswapRouter.getAmountsOut(toEther(1), [cUSD.address, mUSD.address]));
		//
		//
		// // await Pair.mint(user1.address);

		await Treasury.updateUniswapRouter(UniswapRouter.address);

		await cUSD
			.connect(user1)
			.approve(UniswapRouter.address, toEther(1000000));
		await mUSD
			.connect(user1)
			.approve(UniswapRouter.address, toEther(2000000));
		await celo
			.connect(user1)
			.approve(UniswapRouter.address, toEther(500000));

		await UniswapRouter.connect(user1).addLiquidity(
			cUSD.address,
			mUSD.address,
			toEther(1000000),
			toEther(1000000),
			0,
			0,
			user1.address,
			Math.floor(new Date().getTime() / 1000) + 30 * 60
		);

		await UniswapRouter.connect(user1).addLiquidity(
			mUSD.address,
			celo.address,
			toEther(1000000),
			toEther(500000),
			0,
			0,
			user1.address,
			Math.floor(new Date().getTime() / 1000) + 30 * 60
		);

		// let values = await UniswapRouter.getAmountsOut(toEther(100), [cUSD.address, mUSD.address]);
		// console.log(fromEther(values[0]));
		// console.log(fromEther(values[1]));
		//
		// let values2 = await UniswapRouter.getAmountsOut(toEther(100), [mUSD.address, celo.address]);
		// console.log(fromEther(values2[0]));
		// console.log(fromEther(values2[1]));
		//
		// let values3 = await UniswapRouter.getAmountsOut(toEther(100), [cUSD.address, mUSD.address, celo.address]);
		// console.log(fromEther(values3[0]));
		// console.log(fromEther(values3[1]));
		// console.log(fromEther(values3[2]));

		// values3 = await UniswapRouter.getAmountsOut(toEther(100), [cUSD.address, celo.address]);
		// console.log(fromEther(values3[0]));
		// console.log(fromEther(values3[1]));
		// console.log(fromEther(values3[2]));
	});

	it("Should have correct values", async function () {
		expect(await Treasury.communityAdmin()).to.be.equal(
			CommunityAdmin.address
		);
		expect(await Treasury.owner()).to.be.equal(owner.address);
	});

	it("Should transfer founds to address is owner", async function () {
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		await cUSD.mint(Treasury.address, toEther("100"));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("100")
		);
		await Treasury.transfer(cUSD.address, owner.address, toEther("100"));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		expect(await cUSD.balanceOf(owner.address)).to.be.equal(toEther("100"));
	});

	it("Should update communityAdmin if owner", async function () {
		await Treasury.updateCommunityAdmin(user1.address);
		expect(await Treasury.communityAdmin()).to.be.equal(user1.address);
	});

	it("Should transfer founds to address is communityAdmin", async function () {
		await Treasury.updateCommunityAdmin(user1.address);

		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		await cUSD.mint(Treasury.address, toEther("100"));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("100")
		);
		await Treasury.connect(user1).transfer(
			cUSD.address,
			owner.address,
			toEther("100")
		);
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(0);
		expect(await cUSD.balanceOf(owner.address)).to.be.equal(toEther("100"));
	});

	it("Should update implementation if owner", async function () {
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
			ImpactProxyAdmin.connect(user1).upgrade(
				Treasury.address,
				NewTreasuryImplementation.address
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(
			await ImpactProxyAdmin.getProxyImplementation(Treasury.address)
		).to.be.equal(TreasuryImplementation.address);
	});

	it("Should not update UniswapRouter if not owner", async function () {
		await expect(
			Treasury.connect(user1).updateUniswapRouter(FAKE_ADDRESS)
		).to.be.rejectedWith("Ownable: caller is not the owner");
		expect(await Treasury.uniswapRouter()).to.be.equal(
			UniswapRouter.address
		);
	});

	it("Should update UniswapRouter if owner", async function () {
		await expect(Treasury.updateUniswapRouter(FAKE_ADDRESS))
			.to.emit(Treasury, "UniswapRouterUpdated")
			.withArgs(UniswapRouter.address, FAKE_ADDRESS);
		expect(await Treasury.uniswapRouter()).to.be.equal(FAKE_ADDRESS);
	});

	it("Should not set token if not owner", async function () {
		await expect(
			Treasury.connect(user1).setToken(mUSD.address, 500, [])
		).to.be.rejectedWith("Ownable: caller is not the owner");

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should not set token without rate", async function () {
		await expect(Treasury.setToken(mUSD.address, 0, [])).to.be.rejectedWith(
			"Treasury::setToken: invalid rate"
		);

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should not set token with invalid exchangePath #1", async function () {
		await expect(
			Treasury.setToken(mUSD.address, 500, [mUSD.address])
		).to.be.rejectedWith("Treasury::setToken: invalid exchangePath");

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should not set token with invalid exchangePath #2", async function () {
		await expect(
			Treasury.setToken(mUSD.address, 500, [celo.address, cUSD.address])
		).to.be.rejectedWith("Treasury::setToken: invalid exchangePath");

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should not set token with invalid exchangePath #3", async function () {
		await expect(
			Treasury.setToken(celo.address, 500, [celo.address, cUSD.address])
		).to.be.rejectedWith(
			"Transaction reverted: function call to a non-contract account"
		);

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should set token if owner", async function () {
		await expect(
			Treasury.setToken(mUSD.address, 500, [mUSD.address, cUSD.address])
		)
			.to.be.to.emit(Treasury, "TokenSet")
			.withArgs(mUSD.address, 0, [], 500, [mUSD.address, cUSD.address]);

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(500);
		expect(token.exchangePath.length).to.be.equal(2);
		expect(token.exchangePath[0]).to.be.equal(mUSD.address);
		expect(token.exchangePath[1]).to.be.equal(cUSD.address);
		expect(await Treasury.tokenListLength()).to.be.equal(1);
		expect(await Treasury.tokenListAt(0)).to.be.equal(mUSD.address);
	});

	it("Should set token with empty exchangePath", async function () {
		await expect(Treasury.setToken(mUSD.address, 500, []))
			.to.emit(Treasury, "TokenSet")
			.withArgs(mUSD.address, 0, [], 500, []);

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(500);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(1);
		expect(await Treasury.tokenListAt(0)).to.be.equal(mUSD.address);
	});

	it("Should not remove token if not owner", async function () {
		await Treasury.setToken(mUSD.address, 500, [
			mUSD.address,
			cUSD.address,
		]);

		await expect(
			Treasury.connect(user1).removeToken(mUSD.address)
		).to.be.rejectedWith("Ownable: caller is not the owner");

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(500);
		expect(token.exchangePath.length).to.be.equal(2);
		expect(token.exchangePath[0]).to.be.equal(mUSD.address);
		expect(token.exchangePath[1]).to.be.equal(cUSD.address);
		expect(await Treasury.tokenListLength()).to.be.equal(1);
		expect(await Treasury.tokenListAt(0)).to.be.equal(mUSD.address);
	});

	it("Should revert when removing an invalid token", async function () {
		await expect(Treasury.removeToken(mUSD.address)).to.be.rejectedWith(
			"Treasury::removeToken: this is not a token"
		);
	});

	it("Should remove token if owner", async function () {
		await Treasury.setToken(mUSD.address, 500, [
			mUSD.address,
			cUSD.address,
		]);

		await expect(Treasury.removeToken(mUSD.address))
			.to.emit(Treasury, "TokenRemoved")
			.withArgs(mUSD.address);

		const token = await Treasury.tokens(mUSD.address);
		expect(token.rate).to.be.equal(0);
		expect(token.exchangePath.length).to.be.equal(0);
		expect(await Treasury.tokenListLength()).to.be.equal(0);
	});

	it("Should getConvertedAmount, rate = 1 #1", async function () {
		await Treasury.setToken(mUSD.address, toEther(1), [
			mUSD.address,
			cUSD.address,
		]);

		expect(
			await Treasury.getConvertedAmount(mUSD.address, toEther(1))
		).to.be.equal(toEther("0.996999005991991025"));
	});

	it("Should getConvertedAmount, rate = 1 #2", async function () {
		await Treasury.setToken(mUSD.address, toEther(1), [
			mUSD.address,
			cUSD.address,
		]);

		expect(
			await Treasury.getConvertedAmount(mUSD.address, toEther(100))
		).to.be.equal(toEther("99.690060900928177460"));
	});

	it("Should getConvertedAmount, rate != 1 #1", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.5), [
			mUSD.address,
			cUSD.address,
		]);

		expect(
			await Treasury.getConvertedAmount(mUSD.address, toEther(1))
		).to.be.equal(toEther("0.996999005991991025").div(2));
	});

	it("Should getConvertedAmount, rate != 1 #2", async function () {
		await Treasury.setToken(mUSD.address, toEther(2), [
			mUSD.address,
			cUSD.address,
		]);

		expect(
			await Treasury.getConvertedAmount(mUSD.address, toEther(1))
		).to.be.equal(toEther("0.996999005991991025").mul(2));
	});

	it("Should not getConvertedAmount if invalid token", async function () {
		await expect(
			Treasury.getConvertedAmount(mUSD.address, toEther(1))
		).to.be.rejectedWith(
			"Treasury::getConvertedAmount: this is not a valid token"
		);
	});

	it("Should not convertAmount if not owner", async function () {
		await Treasury.setToken(mUSD.address, toEther(2), [
			mUSD.address,
			cUSD.address,
		]);

		await expect(
			Treasury.connect(user1).convertAmount(
				mUSD.address,
				toEther(1),
				123,
				[],
				0
			)
		).to.be.rejectedWith("Ownable: caller is not the owner");
	});

	it("Should not convertAmount if invalid token", async function () {
		await expect(
			Treasury.convertAmount(mUSD.address, toEther(1), 123, [], 0)
		).to.be.rejectedWith(
			"Treasury::convertAmount: this is not a valid token"
		);
	});

	it("Should convertAmount #1", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await mUSD.mint(Treasury.address, toEther(1));

		await expect(Treasury.convertAmount(mUSD.address, toEther(1), 0, [], 0))
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(1),
				0,
				[mUSD.address, cUSD.address],
				toEther("0.996999005991991025")
			);

		expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("0.996999005991991025")
		);
	});

	it("Should convertAmount #2", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await mUSD.mint(Treasury.address, toEther(1000));

		await expect(
			Treasury.convertAmount(mUSD.address, toEther(1000), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(1000),
				0,
				[mUSD.address, cUSD.address],
				toEther("996.006981039903216493")
			);

		expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("996.006981039903216493")
		);
	});

	it("Should convertAmount #3", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await mUSD.mint(Treasury.address, toEther(500000));

		await expect(
			Treasury.convertAmount(mUSD.address, toEther(500000), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(500000),
				0,
				[mUSD.address, cUSD.address],
				toEther("332665.999332665999332665")
			);

		expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("332665.999332665999332665")
		);
	});

	it("Should convertAmount #4", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await mUSD.mint(Treasury.address, toEther(1000000));

		await expect(
			Treasury.convertAmount(mUSD.address, toEther(1000000), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(1000000),
				0,
				[mUSD.address, cUSD.address],
				toEther("499248.873309964947421131")
			);

		expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("499248.873309964947421131")
		);
	});

	it("Should convertAmount #5", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await mUSD.mint(Treasury.address, toEther(1000000));

		await expect(
			Treasury.convertAmount(mUSD.address, toEther(500000), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(500000),
				0,
				[mUSD.address, cUSD.address],
				toEther("332665.999332665999332665")
			);
		await expect(
			Treasury.convertAmount(mUSD.address, toEther(500000), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				mUSD.address,
				toEther(500000),
				0,
				[mUSD.address, cUSD.address],
				toEther("166457.843048619464264531")
			);

		expect(await mUSD.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("499123.842381285463597196")
		);
	});

	it("Should convertAmount #6", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await Treasury.setToken(celo.address, toEther(0.5), [
			celo.address,
			mUSD.address,
			cUSD.address,
		]);

		await celo.mint(Treasury.address, toEther(100));

		await expect(
			Treasury.convertAmount(celo.address, toEther(100), 0, [], 0)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				celo.address,
				toEther(100),
				0,
				[celo.address, mUSD.address, cUSD.address],
				toEther("198.722668275791776817")
			);

		expect(await celo.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("198.722668275791776817")
		);
	});

	it("Should convertAmount with custom path", async function () {
		await Treasury.setToken(mUSD.address, toEther(0.9), [
			mUSD.address,
			cUSD.address,
		]);
		await Treasury.setToken(celo.address, toEther(0.5), [
			celo.address,
			mUSD.address,
			cUSD.address,
		]);

		await cUSD
			.connect(user1)
			.approve(UniswapRouter.address, toEther(1000000));
		await celo
			.connect(user1)
			.approve(UniswapRouter.address, toEther(500000));
		await UniswapRouter.connect(user1).addLiquidity(
			cUSD.address,
			celo.address,
			toEther(1000000),
			toEther(500000),
			0,
			0,
			user1.address,
			Math.floor(new Date().getTime() / 1000) + 30 * 60
		);

		await celo.mint(Treasury.address, toEther(100));

		await expect(
			Treasury.convertAmount(
				celo.address,
				toEther(100),
				0,
				[celo.address, cUSD.address],
				0
			)
		)
			.to.emit(Treasury, "AmountConverted")
			.withArgs(
				celo.address,
				toEther(100),
				0,
				[celo.address, cUSD.address],
				toEther("199.360247566635212938")
			);

		expect(await celo.balanceOf(Treasury.address)).to.be.equal(toEther(0));
		expect(await cUSD.balanceOf(Treasury.address)).to.be.equal(
			toEther("199.360247566635212938")
		);
	});
});
